/**
 * Reads people typed or pasted as a list: one per line or separated by commas or semicolons,
 * each either `email`, `Name <email>`, or `Name email` (as copied from a spreadsheet).
 */

const EMAIL = /[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}/;

/**
 * @param {string} text
 * @returns {{ people: Array<{ email: string, name: string }>, invalid: string[] }}
 */
export function parsePeople(text) {
  /** @type {Map<string, string>} */
  const found = new Map();
  /** @type {string[]} */
  const invalid = [];
  // Commas separate people unless they sit inside a "Last, First" <email> quote.
  const entries = text.split(/\n|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((entry) => entry.trim()).filter(Boolean);
  for (const entry of entries) {
    const match = entry.match(EMAIL);
    if (!match) {
      invalid.push(entry);
      continue;
    }
    const email = match[0].toLowerCase();
    const name = entry
      .replace(match[0], "")
      .replace(/[<>()"\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    if (!found.has(email) || (!found.get(email) && name)) found.set(email, name);
  }
  return { people: [...found].map(([email, name]) => ({ email, name })), invalid };
}

/** @param {{ email: string, name?: string }} person */
export const displayName = (person) => person.name || person.email;
