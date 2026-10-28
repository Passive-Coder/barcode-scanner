import { toast } from "../stores/toast.js";
import { errorMessage } from "./format.js";

/**
 * Runs a person's action and reports any failure as a toast, so handlers never leave an
 * unhandled rejection behind.
 * @template T
 * @param {() => Promise<T>} action
 * @param {string} context logged with the error for debugging
 * @returns {Promise<T | undefined>}
 */
export async function attempt(action, context) {
  try {
    return await action();
  } catch (error) {
    console.warn(context, error);
    toast.error(errorMessage(error));
    return undefined;
  }
}
