/**
 * Registration number parser.
 * Format: "LAW/M/1714/05/26" — first segment is the school/program code.
 */

export interface ParsedRegistration {
  schoolCode: string;
  raw: string;
  segments: string[];
}

export function parseRegistrationNumber(regNumber: string): ParsedRegistration | null {
  if (!regNumber || typeof regNumber !== 'string') return null;

  const trimmed = regNumber.trim();
  if (!trimmed) return null;

  const segments = trimmed.split('/').map(s => s.trim()).filter(Boolean);
  if (segments.length < 2) return null;

  return {
    schoolCode: segments[0].toUpperCase(),
    raw: trimmed,
    segments,
  };
}
