import { writable, get } from 'svelte/store';
import { persisted } from './localstorage.js';
import { v4 as uuidv4 } from 'uuid';
import { llumHostedAddress } from './sync.js';

export const controller = writable(null);

export const params = persisted('params', {
	temperature: 0.3,
	maxTokens: 0,
	messagesContextLimit: 0,
	reasoningEffort: {
		'low-medium-high': 'high',
		range: 64000,
	},
});

export const config = persisted('config', {
	explicitToolView: false,
});

export const openaiAPIKey = persisted('openaiAPIKey', '');
export const openrouterAPIKey = persisted('openrouterkey', '');
export const anthropicAPIKey = persisted('anthropicAPIKey', '');
export const groqAPIKey = persisted('groqAPIKey', '');
export const mistralAPIKey = persisted('mistralAPIKey', '');

export function getAPIKeysAsObject() {
	return {
		openai: get(openaiAPIKey),
		openrouter: get(openrouterAPIKey),
		anthropic: get(anthropicAPIKey),
		groq: get(groqAPIKey),
		mistral: get(mistralAPIKey),
	};
}

export function setAPIKeysFromObject(obj) {
	openaiAPIKey.set(obj.openai || '');
	openrouterAPIKey.set(obj.openrouter || '');
	anthropicAPIKey.set(obj.anthropic || '');
	groqAPIKey.set(obj.groq || '');
	mistralAPIKey.set(obj.mistral || '');
}

export const remoteServer = persisted('remoteServer', { address: 'http://localhost:8081', password: '' });
export const syncServer = persisted('syncServer', {
	address: llumHostedAddress,
	token: uuidv4(),
	password: '',
});
export const toolSchema = persisted('toolSchemaGroups', []);
