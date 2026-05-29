import { customAlphabet } from "nanoid";

// URL-safe alphabet excluding visually ambiguous chars (0, O, I, l)
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DEFAULT_LENGTH = 7;

const generateNanoid = customAlphabet(ALPHABET, DEFAULT_LENGTH);

export function generateSlug(length = DEFAULT_LENGTH): string {
  return generateNanoid(length);
}

// Validates a custom slug: 3-20 chars, alphanumeric + hyphens
export function isValidSlug(slug: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/.test(slug) ||
    /^[a-zA-Z0-9]{3,20}$/.test(slug);
}

// Sanitise user-supplied slug
export function sanitizeSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20);
}
