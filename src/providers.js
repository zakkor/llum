import { get } from 'svelte/store';
import {
	openaiAPIKey,
	groqAPIKey,
	openrouterAPIKey,
	remoteServer,
	mistralAPIKey,
	anthropicAPIKey,
} from './stores.js';

export const providers = [
	{
		name: 'OpenRouter',
		url: 'https://openrouter.ai/api',
		completionUrl: '/v1/chat/completions',
		modelsUrl: '/v1/models',
		responseMapperFn: (json) => {
			return json.data
				.map((m) => {
					if (m.id.startsWith('openai/')) {
						const mc = capabilities.OpenAI.forModel({
							...m,
							id: m.id.slice('openai/'.length),
						});
						if (mc) {
							return { ...mc, id: m.id, name: m.name, provider: 'OpenRouter' };
						}
						return null;
					} else if (m.id.startsWith('anthropic/')) {
						if (
							[
								'anthropic/claude-3.7-sonnet',
								'anthropic/claude-3.7-sonnet:beta',
								'anthropic/claude-3.7-sonnet:thinking',
							].includes(m.id)
						) {
							return {
								...capabilities.Anthropic.sonnet37(m),
								id: m.id,
								name: m.name,
								provider: 'OpenRouter',
							};
						}

						const mc = capabilities.Anthropic.forModel({
							...m,
							id: m.id.slice('anthropic/'.length),
						});
						if (mc) {
							return { ...mc, id: m.id, name: m.name, provider: 'OpenRouter' };
						}
						return null;
					}

					return { ...capabilities.Fallback.forModel(m), provider: 'OpenRouter' };
				})
				.filter(Boolean);
		},
		apiKeyFn: () => get(openrouterAPIKey),
	},
	{
		name: 'Anthropic',
		url: 'https://api.anthropic.com',
		completionUrl: '/v1/messages',
		modelsUrl: '/v1/models',
		responseMapperFn: (json) => json.data.map((m) => capabilities.Anthropic.forModel(m)),
		apiKeyFn: () => get(anthropicAPIKey),
	},
	{
		name: 'OpenAI',
		url: 'https://api.openai.com',
		completionUrl: '/v1/chat/completions',
		modelsUrl: '/v1/models',
		responseMapperFn: (json) =>
			json.data.map((m) => capabilities.OpenAI.forModel(m)).filter(Boolean),
		apiKeyFn: () => get(openaiAPIKey),
	},
	{
		name: 'Groq',
		url: 'https://api.groq.com/openai',
		completionUrl: '/v1/chat/completions',
		modelsUrl: '/v1/models',
		apiKeyFn: () => get(groqAPIKey),
	},
	{
		name: 'Mistral',
		url: 'https://api.mistral.ai',
		completionUrl: '/v1/chat/completions',
		modelsUrl: '/v1/models',
		apiKeyFn: () => get(mistralAPIKey),
	},
	{
		name: 'Ollama',
		url: 'http://localhost:11434',
		completionUrl: '/v1/chat/completions',
		modelsUrl: '/api/tags',
		responseMapperFn: (json) => {
			return json.models.map((m) => ({
				id: m.name,
				name: m.name,
				provider: 'Ollama',
				modality: 'text->text',
			}));
		},
		apiKeyFn: () => false,
	},
].filter(Boolean);

// Central place where we define mapping functions that define what each model from every provider can do.
// Note that these functions can also decide to completely ignore models that are unsupported.
const capabilities = {
	OpenAI: {
		forModel: (model) => {
			if (capabilities.OpenAI.shouldIgnore(model.id)) {
				return null;
			}
			const modality = capabilities.OpenAI.isImageGenerator(model.id)
				? 'text->image'
				: capabilities.OpenAI.isMultimodal(model.id)
					? 'text+image->text'
					: 'text->text';
			const isReasoner = capabilities.OpenAI.isReasoner(model.id);
			const kind = isReasoner ? 'reasoner' : 'plain';
			const reasoningEffortControls =
				isReasoner && capabilities.OpenAI.reasoningEffortControls(model.id);
			const reasoningTracesVisibility = isReasoner ? 'hidden' : undefined;
			const reinsertReasoningTracesOnSubmit = isReasoner ? false : undefined;
			const temperatureUnsupported = isReasoner;
			return {
				id: model.id,
				name: model.id,
				provider: 'OpenAI',
				modality,
				kind,
				reasoningEffortControls,
				reasoningTracesVisibility,
				reinsertReasoningTracesOnSubmit,
				temperatureUnsupported,
			};
		},
		shouldIgnore: (id) =>
			[
				'dall-e-2',
				'whisper-1',
				'tts-1-hd',
				'tts-1-hd-1106',
				'tts-1',
				'tts-1-1106',
				'davinci-002',
				'babbage-002',
				'text-embedding-3-large',
				'text-embedding-3-small',
				'text-embedding-ada-002',
				'omni-moderation-latest',
				'omni-moderation-2024-09-26',
				'text-moderation-latest',
				'text-moderation-stable',
				'text-moderation-007',
			].includes(id) ||
			id.includes('realtime-preview') ||
			id.includes('audio-preview'),

		isMultimodal: (id) =>
			id === 'chatgpt-4o-latest' ||
			id.startsWith('gpt-4o') ||
			(id.startsWith('gpt-4-turbo') && id !== 'gpt-4-turbo-preview') ||
			((id.startsWith('o1') || id.startsWith('o3-mini')) &&
				!id.startsWith('o1-mini') &&
				!id.startsWith('o1-preview')),

		isReasoner: (id) => id.startsWith('o1') || id.startsWith('o3'),

		isImageGenerator: (id) => ['dall-e-3'].includes(id),

		reasoningEffortControls: (id) =>
			(!id.startsWith('o1-preview') && !id.startsWith('o1-mini') && id.startsWith('o1')) ||
			id.startsWith('o3-mini')
				? 'low-medium-high'
				: undefined,
	},
	Anthropic: {
		forModel: (model) => {
			if (model.id === 'claude-3-7-sonnet-20250219') {
				return capabilities.Anthropic.sonnet37(model);
			}
			return {
				id: model.id,
				name: model.display_name,
				provider: 'Anthropic',
				modality: 'text+image->text',
			};
		},
		sonnet37: (model) => {
			return {
				id: model.id,
				name: model.display_name,
				provider: 'Anthropic',
				modality: 'text+image->text',
				kind: 'reasoner',
				reasoningEffortControls: 'range',
				reasoningEffortRange: [0, 64000],
				reasoningTracesVisibility: 'visible-and-redacted',
				reinsertReasoningTracesOnSubmit: true,
				maxTokensDefault: 128000,
			};
		},
	},
	Fallback: {
		forModel: (model) => {
			return {
				id: model.id,
				name: model.name || model.id,
				modality: model.architecture?.modality,
			};
		},
	},
};

export async function fetchModels({ onFinally }) {
	try {
		const promises = providers.map((provider) => {
			const apiKey = provider.apiKeyFn();
			if (apiKey === '') {
				return [];
			}

			return fetch(`${provider.url}${provider.modelsUrl}`, {
				method: 'GET',
				headers: headersForFetch(provider, null),
			})
				.then((response) => response.json())
				.then((json) => {
					if (provider.responseMapperFn) {
						return provider.responseMapperFn(json);
					}
					return json.data.map((m) => ({
						...capabilities.Fallback.forModel(m),
						provider: provider.name,
					}));
				})
				.catch((err) => {
					console.log('Error fetching models from provider', provider.name, err);
					return [];
				});
		});

		const results = await Promise.all(promises);
		const externalModels = results.flat();

		function getPriorityIndex(model) {
			for (let i = 0; i < priorityOrder.length; i++) {
				const rule = priorityOrder[i];
				if (rule.exactly) {
					const exactIndex = rule.exactly.indexOf(model.id);
					if (exactIndex !== -1) {
						return [i, exactIndex];
					}
				}
				if (rule.startsWith) {
					for (let j = 0; j < rule.startsWith.length; j++) {
						if (model.id.startsWith(rule.startsWith[j])) {
							if (rule.exactlyNot && rule.exactlyNot.includes(model.id)) {
								continue;
							}
							return [i, j];
						}
					}
				}
				if (rule.fromProvider && model.provider === rule.fromProvider) {
					if (rule.exactlyNot && rule.exactlyNot.includes(model.id)) {
						continue;
					}
					return [i, -1];
				}
			}
			return [priorityOrder.length, -1];
		}

		externalModels.sort((a, b) => {
			const [aIndex, aExactIndex] = getPriorityIndex(a);
			const [bIndex, bExactIndex] = getPriorityIndex(b);

			if (aIndex === bIndex) {
				if (aExactIndex === bExactIndex) {
					return a.id.localeCompare(b.id);
				}
				return aExactIndex - bExactIndex;
			}
			return aIndex - bIndex;
		});

		return externalModels;
	} catch (error) {
		console.error('Error fetching models:', error);
	} finally {
		onFinally();
	}
	return [];
}

export function headersForFetch(provider, model) {
	return {
		...(provider.name === 'OpenRouter' ||
		provider.name === 'OpenAI' ||
		provider.name === 'Groq' ||
		provider.name === 'Mistral'
			? {
					Authorization: `Bearer ${provider.apiKeyFn()}`,
				}
			: provider.name === 'Anthropic'
				? {
						'x-api-key': provider.apiKeyFn(),
						...(model?.kind === 'reasoner' ? { 'anthropic-beta': 'output-128k-2025-02-19' } : {}),
						'anthropic-version': '2023-06-01',
						'anthropic-dangerous-direct-browser-access': 'true',
					}
				: {}),
		'Content-Type': 'application/json',
		...(provider.name === 'OpenRouter'
			? {
					'HTTP-Referer': 'https://llum.chat',
					'X-Title': 'llum',
				}
			: {}),
	};
}

export const priorityOrder = [
	{ fromProvider: 'Ollama' },
	{
		exactly: [
			'anthropic/claude-3.7-sonnet',
			'anthropic/claude-3.5-sonnet',
			'anthropic/claude-3.5-haiku',
			'anthropic/claude-3-opus',
		],
	},
	{
		exactly: [
			'claude-3-7-sonnet-20250219',
			'claude-3-5-sonnet-20241022',
			'claude-3-5-haiku-20241022',
			'claude-3-opus-20240229',
		],
	},
	{ exactly: ['deepseek/deepseek-r1', 'deepseek/deepseek-chat'] },
	{
		exactly: [
			'openai/o3-mini',
			'openai/o1',
			'openai/o1-preview',
			'openai/o1-mini',
			'openai/gpt-4-turbo',
			'openai/chatgpt-4o-latest',
			'openai/gpt-4o',
			'openai/gpt-4o-mini',
		],
	},
	{
		exactly: [
			'o3-mini',
			'o1',
			'o1-preview',
			'o1-mini',
			'gpt-4o',
			'gpt-4o-mini',
			'gpt-4-turbo',
			'dall-e-3',
		],
	},
	{ startsWith: ['qwen'] },
	{
		exactly: [
			'meta-llama/llama-3.3-70b-instruct',
			'meta-llama/llama-3.1-405b-instruct',
			'meta-llama/llama-3.1-405b',
		],
	},
	{ fromProvider: 'Groq' },
];

export function hasCompanyLogo(model) {
	return (
		model &&
		model.provider &&
		(model.provider === 'Anthropic' ||
			model.provider === 'OpenAI' ||
			model.provider === 'Mistral' ||
			model.provider === 'Groq' ||
			model.id.startsWith('openai') ||
			model.id.startsWith('anthropic') ||
			model.id.startsWith('meta-llama') ||
			model.id.startsWith('mistralai') ||
			model.id.startsWith('cohere') ||
			model.id.startsWith('nous') ||
			model.id.startsWith('google') ||
			model.id.startsWith('perplexity') ||
			model.id.startsWith('deepseek') ||
			model.id.startsWith('qwen'))
	);
}

export function formatModelName(model, short = false) {
	if (model.id === null) {
		return model.name;
	}

	if (short) {
		const split = model.name.split(': ');
		if (split.length > 1) {
			return split[1];
		}
	}

	let name = model.name;

	// If providers clash, disambiguate provider name
	const disambiguate =
		(get(openaiAPIKey).length > 0 && get(openrouterAPIKey).length > 0) ||
		(get(anthropicAPIKey).length > 0 && get(openrouterAPIKey).length > 0);

	if (model.provider === 'OpenAI') {
		name = name.replace('gpt', 'GPT').replace('dall-e-3', 'DALL-E 3');
	}

	if (model.provider === 'Groq') {
		return model.provider + ': ' + name;
	}
	if (disambiguate && model.provider === 'OpenRouter' && name.includes(': ')) {
		return model.provider + ': ' + name.split(': ')[1];
	}
	if (disambiguate) {
		return model.provider + ': ' + name;
	}

	return name;
}

export function formatMultipleModelNames(models, short = false) {
	if (models.length === 1) {
		return formatModelName(models[0], short);
	}
	if (models.length === 2) {
		return formatModelName(models[0], short) + ', ' + formatModelName(models[1], short);
	}
	return (
		formatModelName(models[0], short) +
		', ' +
		formatModelName(models[1], short) +
		', + ' +
		(models.length - 2)
	);
}
