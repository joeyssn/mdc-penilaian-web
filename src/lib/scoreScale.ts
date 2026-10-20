// Everything is shown to users as 1-4. The database enum (score_value) still stores A-D,
// so no migration is needed: 4 = A, 3 = B, 2 = C, 1 = D.
export type ScoreLetter = 'A' | 'B' | 'C' | 'D';

export const SCALE_VALUES = [1, 2, 3, 4] as const;

const NUM_TO_LETTER: Record<number, ScoreLetter> = { 4: 'A', 3: 'B', 2: 'C', 1: 'D' };
const LETTER_TO_NUM: Record<ScoreLetter, number> = { A: 4, B: 3, C: 2, D: 1 };

// Accepts 1-4 (number or numeric string) or a legacy letter. Returns null if invalid.
export function toStoredScore(value: unknown): ScoreLetter | null {
  if (typeof value === 'string' && value.toUpperCase() in LETTER_TO_NUM) {
    return value.toUpperCase() as ScoreLetter;
  }
  const n = Number(value);
  return Number.isInteger(n) && NUM_TO_LETTER[n] ? NUM_TO_LETTER[n] : null;
}

export function toNumericScore(letter: string): number {
  return LETTER_TO_NUM[letter as ScoreLetter] ?? 0;
}
