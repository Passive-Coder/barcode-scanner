/**
 * @typedef {{ title: string, message: string, confirmLabel?: string, danger?: boolean, notice?: boolean }} ConfirmOptions notice: a single OK button
 * @typedef {{ label: string, value?: string, placeholder?: string }} FormField
 * @typedef {{
 *   title: string,
 *   description?: string,
 *   fields: FormField[],
 *   submitLabel?: string,
 *   onSubmit: (values: string[]) => Promise<void>,
 * }} FormOptions
 */

/**
 * Themed replacements for window.confirm/prompt. Each request resolves once the person
 * answers, so callers can simply `await dialogs.confirm(...)`.
 */
class DialogStore {
  /** @type {(ConfirmOptions & { resolve: (confirmed: boolean) => void }) | null} */
  confirmation = $state.raw(null);
  /** @type {(FormOptions & { resolve: (saved: boolean) => void }) | null} */
  form = $state.raw(null);
  settingsOpen = $state(false);
  accountOpen = $state(false);

  /** @param {ConfirmOptions} options @returns {Promise<boolean>} */
  confirm(options) {
    this.confirmation?.resolve(false);
    return new Promise((resolve) => {
      this.confirmation = { ...options, resolve };
    });
  }

  /** @param {boolean} confirmed */
  settleConfirmation(confirmed) {
    const request = this.confirmation;
    this.confirmation = null;
    request?.resolve(confirmed);
  }

  /**
   * Opens an editor. `onSubmit` runs while the dialog shows a busy state; if it throws, the
   * error is shown inside the dialog and the person can correct their input.
   * @param {FormOptions} options
   * @returns {Promise<boolean>} whether the form was saved
   */
  edit(options) {
    this.form?.resolve(false);
    return new Promise((resolve) => {
      this.form = { ...options, resolve };
    });
  }

  /** @param {boolean} saved */
  settleForm(saved) {
    const request = this.form;
    this.form = null;
    request?.resolve(saved);
  }
}

export const dialogs = new DialogStore();
