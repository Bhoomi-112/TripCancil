import { randomBytes } from "node:crypto";

/**
 * Unambiguous alphabet: no I, O, 0 or 1, so a code read aloud off a screen
 * survives a WhatsApp forward. 32^12 is ~1.2e18 possibilities.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 12;

/** Codes are stored uppercase and compared uppercase, so typing is forgiving. */
export function normaliseInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH * 2);
  let code = "";
  for (const byte of bytes) {
    if (code.length === INVITE_CODE_LENGTH) break;
    // Rejection sampling keeps the distribution uniform across the alphabet.
    if (byte < 256 - (256 % ALPHABET.length)) {
      code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code.length === INVITE_CODE_LENGTH
    ? code
    : code + generateInviteCode().slice(0, INVITE_CODE_LENGTH - code.length);
}
