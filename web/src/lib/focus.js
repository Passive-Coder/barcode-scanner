/**
 * Svelte attachment that focuses an element once it's on screen, for the first field of a
 * dialog. (The `autofocus` attribute isn't reliable inside dialogs opened later.)
 * @type {import("svelte/attachments").Attachment<HTMLElement>}
 */
export const focusOnOpen = (node) => {
  const frame = requestAnimationFrame(() => node.focus());
  return () => cancelAnimationFrame(frame);
};
