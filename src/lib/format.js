const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** @param {Date} date */
export const formatTime = (date) => timeFormat.format(date);

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
