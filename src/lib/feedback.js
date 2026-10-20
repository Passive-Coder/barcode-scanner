import { errorMessage } from "./format.js";
import { toast } from "./stores/toast.svelte.js";

/**
 * Runs a user-initiated action and reports any failure as a toast, so event handlers never
 * leave an unhandled rejection behind.
 * @template T
 * @param {() => Promise<T>} action
 * @param {string} context logged with the error for debugging
 * @returns {Promise<T | undefined>}
 */
export async function attempt(action, context) {
  try {
    return await action();
  } catch (error) {
    console.error(context, error);
    toast.error(errorMessage(error));
    return undefined;
  }
}
