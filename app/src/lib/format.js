const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** @param {Date} date */
export const formatTime = (date) => timeFormat.format(date);

/** @param {Date} date */
export const formatDateTime = (date) => dateTimeFormat.format(date);

/** @param {number} count @param {string} singular @param {string} [plural] */
export const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

/**
 * "just now", "5 minutes ago", "yesterday", then a date. (Hermes has no Intl.RelativeTimeFormat.)
 * @param {number} timestamp @param {number} [now]
 */
export function timeAgo(timestamp, now = Date.now()) {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${pluralize(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${pluralize(hours, "hour")} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDateTime(new Date(timestamp));
}

/** Turns `jane.doe@example.com` into `Jane Doe` for greetings. */
export function nameFromEmail(email = "") {
  const local = email.split("@")[0];
  if (!local) return "";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

/** @param {unknown} error */
export function errorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Please try again.";
}

/** UTF-8 length of a string, without TextEncoder. @param {string} text */
export function byteLength(text) {
  let bytes = 0;
  for (const character of text) {
    const code = /** @type {number} */ (character.codePointAt(0));
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}
