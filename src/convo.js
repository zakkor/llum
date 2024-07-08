import { get } from 'svelte/store';
import { controller, params, toolSchema } from './stores.js';
import { providers } from './providers.js';

export async function complete(convo, onupdate, onabort, ondirect) {
	controller.set(new AbortController());

	if (convo.model.provider === 'Local') {
		if (!convo.model.template) {
			convo.model.template = 'chatml';
		}
		const response = await fetch('http://localhost:8082/completion', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			signal: get(controller).signal,
			body: JSON.stringify({
				stream: true,
				prompt: conversationToString(convo),
				stop: conversationStop(convo),
				n_predict: -1,
				repeat_penalty: 1.1,
				cache_prompt: true,
				...(convo.grammar !== '' && { grammar: convo.grammar }),
			}),
		});

		streamResponse(response.body, onupdate, onabort);
	} else {
		const param = get(params);

		const openAICompatibleFormat =
			convo.model.provider === 'OpenAI' ||
			convo.model.provider === 'OpenRouter' ||
			convo.model.provider === 'Groq';

		let messages = openAICompatibleFormat
			? convo.messages.map(messageToOpenAIFormat)
			: // TODO: Support for Anthropic
				convo.messages;

		if (param.messagesContextLimit > 0) {
			messages = limitMessagesContext(messages, param.messagesContextLimit);
		}

		// TODO: Actually it works with Anthropic also. How to show it as disabled for unsupported?
		// Filter out unclosed messages from being submitted if using external models
		if (
			convo.messages[convo.messages.length - 1].unclosed &&
			convo.messages[convo.messages.length - 1].content === ''
		) {
			messages.pop();
		}

		const schema = get(toolSchema)
			.map((group) => group.schema)
			.flat();
		const activeSchema = schema
			.filter((tool) => (convo.tools || []).includes(tool.function.name))
			.map((tool) => ({
				type: tool.type,
				function: tool.function,
			}));

		const provider = providers.find((p) => p.name === convo.model.provider);

		// All providers now support streaming completions for tool calls!
		const stream = true;

		const completions = async (signal) => {
			return fetch(`${provider.url}/v1/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${provider.apiKeyFn()}`,
					'Content-Type': 'application/json',
					...(convo.model.provider === 'OpenRouter'
						? {
								'HTTP-Referer': 'https://lluminous.chat',
								'X-Title': 'lluminous',
							}
						: {}),
				},
				signal,
				body: JSON.stringify({
					stream,
					model: convo.model.id,
					temperature: param.temperature,
					max_tokens: param.maxTokens != null && param.maxTokens > 0 ? param.maxTokens : undefined,
					tools: activeSchema.length > 0 ? activeSchema : undefined,
					messages,
				}),
			});
		};

		if (stream) {
			const response = await completions(get(controller).signal);
			streamResponse(response.body, onupdate, onabort);
		} else {
			const response = await completions();
			ondirect(await response.json());
		}
	}
}

function messageToOpenAIFormat(msg) {
	const msgConverted = {
		role: msg.role,
	};

	if (msg.contentParts) {
		msgConverted.content = [
			{
				type: 'text',
				text: msg.content,
			},
			...msg.contentParts,
		];
	} else if (msg.role === 'tool') {
		// FIXME: This might double stringify the content
		// FIXME: This might double stringify the content
		// FIXME: This might double stringify the content
		// FIXME: This might double stringify the content
		// FIXME: This might double stringify the content
		// FIXME: This might double stringify the content
		msgConverted.content = JSON.stringify(msg.content);
	} else {
		msgConverted.content = msg.content;
	}

	// Additional data for tool calls
	if (msg.toolcalls) {
		msgConverted.tool_calls = msg.toolcalls.map((t) => {
			return {
				id: t.id,
				type: 'function',
				function: {
					name: t.name,
					// FIXME: This might double stringify the content (???)
					// FIXME: This might double stringify the content (???)
					// FIXME: This might double stringify the content (???)
					// FIXME: This might double stringify the content (???)
					arguments: JSON.stringify(t.arguments),
				},
			};
		});
	}
	// Additional data for tool responses
	if (msg.toolcallId && msg.name) {
		msgConverted.tool_call_id = msg.toolcallId;
		msgConverted.name = msg.name;
	}

	return msgConverted;
}

async function streamResponse(readableStream, onupdate, onabort) {
	try {
		const reader = readableStream.getReader();
		const decoder = new TextDecoder();

		let done, value;
		let leftover = '';
		while (!done) {
			({ value, done } = await reader.read());

			if (done) {
				return;
			}

			const string = decoder.decode(value);
			const lines = string.split('\n\n');
			for (let line of lines) {
				if (line === '') {
					continue;
				}

				// If we have leftover from the previous chunk, prepend it to the current line
				if (leftover !== '') {
					line = leftover + line;
					leftover = '';
				}

				// Ignore comments
				if (line[0] === ':') {
					continue;
				}

				// OpenAI and only OpenAI sometimes sends "\ndata:"
				line = line.trim();

				if (line.startsWith('data: ')) {
					// Strip "data: " from the start of the url
					const event = line.substring('data: '.length);

					// OpenAI-compatible APIs send "data: [DONE]" at the end of the stream
					if (event === '[DONE]') {
						onabort();
						return;
					}

					try {
						const parsed = JSON.parse(event);
						onupdate(parsed);
					} catch (err) {
						// If the JSON parsing fails, we've got an incomplete event
						leftover = line;
					}
				} else if (line.startsWith('error: ')) {
					console.error('received error event:', line);
					onabort();
					return;
				} else {
					console.log('received unknown event:', string);
					try {
						// If it's a nicely formatted error, display it.
						onupdate({ error: JSON.parse(string).error });
					} catch (_) {
						// Otherwise display whatever unknown event we got.
						onupdate({ error: string });
					}
				}
			}
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			onabort();
		} else {
			console.log(`error.name:`, error.name);
			throw error;
		}
	}
}

function limitMessagesContext(messages, messagesContextLimit) {
	if (messagesContextLimit <= 0) return messages;

	const isFirstMessageSystem = messages[0]?.role === 'system';
	const systemMessage = isFirstMessageSystem ? messages[0] : null;
	const conversationMessages = isFirstMessageSystem ? messages.slice(1) : messages;

	const turns = [];
	let currentTurn = [];

	for (const message of conversationMessages) {
		if (message.role === 'user' && currentTurn.length > 0) {
			turns.push(currentTurn);
			currentTurn = [];
		}
		currentTurn.push(message);
	}
	if (currentTurn.length > 0) {
		turns.push(currentTurn);
	}

	const limitedTurns = turns.slice(-messagesContextLimit);
	const limitedMessages = limitedTurns.flat();

	if (systemMessage) {
		limitedMessages.unshift(systemMessage);
	}

	return limitedMessages;
}

export async function generateImage(convo, { oncomplete }) {
	const provider = providers.find((p) => p.name === convo.model.provider);
	const userMessages = convo.messages.filter((msg) => msg.role === 'user');
	const lastMessage = userMessages[userMessages.length - 1];

	const resp = await fetch(`${provider.url}/v1/images/generations`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${provider.apiKeyFn()}`,
			'HTTP-Referer': 'https://lluminous.chat',
			'X-Title': 'lluminous',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: convo.model.id,
			prompt: lastMessage.content,
			n: 1,
			size: '1024x1024',
		}),
	});
	const json = await resp.json();
	oncomplete(json);
}

export function conversationToString(convo) {
	let result = '';
	convo.messages.forEach((msg) => {
		result += messageToString(msg, convo.model.template);
	});
	return result;
}

function conversationStop(convo) {
	switch (convo.model.template) {
		case 'chatml':
			return ['<|im_end|>', '<|im_start|>', '</tool_call>'];
		case 'deepseek':
			return ['### Instruction:', '### Response:'];
		case 'none':
			return ['</s>'];
		default:
			throw new Error('Unknown template');
	}
}

function messageToString(message, template) {
	switch (template) {
		case 'chatml':
			let s = '<|im_start|>' + message.role + '\n' + message.content;
			if (!message.unclosed) {
				s += '<|im_end|>\n';
			}
			return s;
		case 'deepseek':
			if (message.role === 'system') {
				return message.content + '\n';
			}
			if (message.role === 'user') {
				return '### Instruction:\n' + message.content + '\n';
			}
			if (message.role === 'assistant') {
				return '### Response:\n' + message.content + '\n';
			}
		case 'none':
			return message.content;
	}
}
