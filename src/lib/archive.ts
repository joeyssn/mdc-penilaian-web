// Pure helpers for the semester archive (no database), so they can be unit-tested.

export type Labels = { users: Record<string, string>; indicators: Record<string, string>; rubrics: Record<string, string> };

// Names and question texts at archive time, so an archive still reads correctly after users or rubrics change.
export function buildLabels(
  refs: { userIds: string[]; indicatorIds: string[]; rubricIds: string[] },
  users: { id: string; name: string }[], indicators: { id: string; text: string }[], rubrics: { id: string; title: string }[]
): Labels {
  const pick = <T extends { id: string }>(ids: string[], rows: T[], f: (r: T) => string) => {
    const want = new Set(ids); const out: Record<string, string> = {};
    for (const r of rows) if (want.has(r.id)) out[r.id] = f(r);
    return out;
  };
  return { users: pick(refs.userIds, users, u => u.name), indicators: pick(refs.indicatorIds, indicators, i => i.text), rubrics: pick(refs.rubricIds, rubrics, r => r.title) };
}

const LETTER: Record<number, string> = { 4: 'A', 3: 'B', 2: 'C', 1: 'D' };
export const validScore = (v: unknown): v is 1 | 2 | 3 | 4 => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 4;

// Change one rubric score inside an archived `scoresData` array. Returns the new array and the old value.
export function editArchivedScore(rows: any[], scoreId: string, value: number) {
  const i = rows.findIndex(r => r.id === scoreId);
  if (i < 0) throw new Error('Score not found in this archive record.');
  if (!validScore(value)) throw new Error('Score must be a whole number from 1 to 4.');
  const before = rows[i].value;
  const next = rows.map((r, idx) => (idx === i ? { ...r, value: LETTER[value] } : r));
  return { next, before };
}

// Change one answer of an archived SD evaluation and recompute its average.
export function editArchivedSdAnswer(rows: any[], evaluationId: string, indicatorId: string, value: number) {
  const i = rows.findIndex(r => r.id === evaluationId);
  if (i < 0) throw new Error('Evaluation not found in this archive record.');
  if (!validScore(value)) throw new Error('Score must be a whole number from 1 to 4.');
  const answers: { indicatorId: string; value: number }[] = Array.isArray(rows[i].answers) ? rows[i].answers : [];
  const j = answers.findIndex(a => a.indicatorId === indicatorId);
  if (j < 0) throw new Error('Answer not found in this evaluation.');
  const before = answers[j].value;
  const newAnswers = answers.map((a, idx) => (idx === j ? { ...a, value } : a));
  const average = newAnswers.reduce((s, a) => s + a.value, 0) / newAnswers.length;
  return { next: rows.map((r, idx) => (idx === i ? { ...r, answers: newAnswers, average } : r)), before };
}
