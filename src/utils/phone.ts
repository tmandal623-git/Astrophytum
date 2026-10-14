// Indian mobile numbers: 10 digits starting 6–9, optionally prefixed with +91, 91 or 0.
// Spaces, hyphens and brackets are ignored. Mirrors normalizeIndianMobile() in api/server.js.
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, '');
  const match  = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}
