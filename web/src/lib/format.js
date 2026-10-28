const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** @param {Date} date */
export const formatTime = (date) => timeFormat.format(date);

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** @param {Date} date */
export const formatDateTime = (date) => dateTimeFormat.format(date);

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", then a date. @param {number} timestamp @param {number} [now] */
export function timeAgo(timestamp, now = Date.now()) {
  const seconds = Math.round((timestamp - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormat.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relativeFormat.format(days, "day");
  return formatDateTime(new Date(timestamp));
}

/** @param {number} value */
export const pad2 = (value) => String(value).padStart(2, "0");

/** @param {number} count @param {string} singular @param {string} [plural] */
export const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

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
