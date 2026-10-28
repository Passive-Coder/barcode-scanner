import { Store } from "../lib/store.js";

/**
 * @typedef {{ title: string, message: string, confirmLabel?: string, danger?: boolean, notice?: boolean }} ConfirmOptions notice: a single OK button
 * @typedef {{ label: string, value?: string, placeholder?: string, multiline?: boolean, keyboard?: "default" | "email-address" | "numeric" | "url" }} FormField
 * @typedef {{
 *   title: string,
 *   description?: string,
 *   fields: FormField[],
 *   submitLabel?: string,
 *   onSubmit: (values: string[]) => Promise<void>,
 * }} FormOptions
 */

/**
 * Confirmations and small forms, shown over the current screen. Each request resolves once the
 * person answers, so callers can simply `await dialogs.confirm(...)`.
 */
class DialogStore extends Store {
  /** @type {(ConfirmOptions & { resolve: (confirmed: boolean) => void }) | null} */
  confirmation = null;
  /** @type {(FormOptions & { resolve: (saved: boolean) => void }) | null} */
  form = null;

  /** @param {ConfirmOptions} options @returns {Promise<boolean>} */
  confirm(options) {
    this.confirmation?.resolve(false);
    return new Promise((resolve) => {
      this.confirmation = { ...options, resolve };
      this.changed();
    });
  }

  /** @param {boolean} confirmed */
  settleConfirmation(confirmed) {
    const request = this.confirmation;
    this.confirmation = null;
    this.changed();
    request?.resolve(confirmed);
  }

  /**
   * Opens a form. `onSubmit` runs while the form shows a busy state; if it throws, the error is
   * shown in the form and the person can correct their input.
   * @param {FormOptions} options
   * @returns {Promise<boolean>} whether the form was saved
   */
  edit(options) {
    this.form?.resolve(false);
    return new Promise((resolve) => {
      this.form = { ...options, resolve };
      this.changed();
    });
  }

  /** @param {boolean} saved */
  settleForm(saved) {
    const request = this.form;
    this.form = null;
    this.changed();
    request?.resolve(saved);
  }
}

export const dialogs = new DialogStore();
