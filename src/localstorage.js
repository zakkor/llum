import { writable, get } from 'svelte/store';

export function persisted(key, initial) {
	const store = writable(initial);
	const { subscribe, set } = store;

	if (initial !== undefined && localStorage.getItem(key) === null) {
		// If initial data is passed in, use it to initialize only if there is no persisted data.
		const toPersist = JSON.stringify(initial);
		localStorage.setItem(key, toPersist);
	} else {
		// Otherwise, read persisted data from localStorage and set value of store to that.
		const persisted = JSON.parse(localStorage.getItem(key));
		set(persisted);
	}

	return {
		subscribe,
		set: (data) => {
			// On set persist data, then update store value.
			const toPersist = JSON.stringify(data);
			localStorage.setItem(key, toPersist);
			set(data);
		},
		update: (updateFn) => {
			const updatedData = updateFn(get(store));
			const toPersist = JSON.stringify(updatedData);
			localStorage.setItem(key, toPersist);
			set(updatedData);
		},
	};
}

export function persistedPicked(parentStore, getFn) {
	const { subscribe, set } = writable(getFn(get(parentStore)));

	const unsubscribe = parentStore.subscribe((value) => {
		set(getFn(value));
	});

	return {
		subscribe,
		set: (value) => {
			parentStore.update((current) => {
				const parent = { ...current };
				const updatedValue = getFn(parent);
				Object.assign(updatedValue, value);
				return parent;
			});
		},
		update: (updateFn) => {
			parentStore.update((current) => {
				const parent = { ...current };
				const updatedValue = getFn(parent);
				Object.assign(updatedValue, updateFn(updatedValue));
				return parent;
			});
		},
		unsubscribe,
	};
}
