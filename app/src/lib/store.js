import { useSyncExternalStore } from "react";

/**
 * Base for the app's stores, which mirror the website's Svelte stores: plain classes whose
 * fields are read directly. After changing fields, a store calls `changed()`, and every
 * component using it (through `useStore`) re-renders.
 */
export class Store {
  /** @type {Set<() => void>} */
  #listeners = new Set();
  #version = 0;

  /** @param {() => void} listener */
  subscribe = (listener) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getVersion = () => this.#version;

  changed() {
    this.#version++;
    for (const listener of [...this.#listeners]) listener();
  }
}

/**
 * Re-renders the component whenever the store changes, and returns the store.
 * @template {Store} T
 * @param {T} store
 * @returns {T}
 */
export function useStore(store) {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return store;
}
