// Pure business rules for the SD teacher evaluation system. No database access here,
// so every rule can be unit-tested. The API routes load data and call these.

export type Subject = 'MATEMATIKA' | 'IPA' | 'BAHASA_INDONESIA' | 'PPKN';
export type Category = 'EXACT' | 'NON_EXACT';

export const SUBJECTS: Subject[] = ['MATEMATIKA', 'IPA', 'BAHASA_INDONESIA', 'PPKN'];

export const SUBJECT_CATEGORY: Record<Subject, Category> = {
  MATEMATIKA: 'EXACT',
  IPA: 'EXACT',
  BAHASA_INDONESIA: 'NON_EXACT',
  PPKN: 'NON_EXACT',
};

// Math <-> Science, Bahasa Indonesia <-> PPKN
export const COUNTERPART: Record<Subject, Subject> = {
  MATEMATIKA: 'IPA',
  IPA: 'MATEMATIKA',
  BAHASA_INDONESIA: 'PPKN',
  PPKN: 'BAHASA_INDONESIA',
};

export const SUBJECT_LABEL: Record<Subject, string> = {
  MATEMATIKA: 'Matematika',
  IPA: 'IPA',
  BAHASA_INDONESIA: 'Bahasa Indonesia',
  PPKN: 'PPKN',
};

export const categoryOf = (s: Subject): Category => SUBJECT_CATEGORY[s];

export type MemberLite = {
  id: string;
  groupId: string;
  teacherId: string;
  className: string;
  subject: Subject;
  partnerId: string | null;
};

export type GroupLite = { id: string; classOne: string; classTwo: string; status: string };

const norm = (s: string) => s.trim().toUpperCase();

// Rule 1: exactly two distinct classes.
export function validateClasses(classOne: string, classTwo: string): string[] {
  const errors: string[] = [];
  if (!classOne?.trim() || !classTwo?.trim()) errors.push('A group needs exactly two classes.');
  else if (norm(classOne) === norm(classTwo)) errors.push('The two classes of a group must be different.');
  return errors;
}

export const groupHasClass = (g: GroupLite, className: string) =>
  norm(g.classOne) === norm(className) || norm(g.classTwo) === norm(className);

// A member must teach in one of the group's two classes.
export function validateMember(g: GroupLite, className: string, subject: string): string[] {
  const errors: string[] = [];
  if (!groupHasClass(g, className)) errors.push(`Class ${className} is not one of this group's two classes.`);
  if (!SUBJECTS.includes(subject as Subject)) errors.push('Unknown subject.');
  return errors;
}

// Rule 2 / Test C: a partnership joins Math<->Science or BI<->PPKN, same class, same group.
export function validatePartnership(a: MemberLite, b: MemberLite): string[] {
  const errors: string[] = [];
  if (a.id === b.id) errors.push('A teacher cannot be their own partner.');
  if (a.groupId !== b.groupId) errors.push('Partners must belong to the same group.');
  if (norm(a.className) !== norm(b.className)) errors.push('Partners must teach in the same class.');
  if (COUNTERPART[a.subject] !== b.subject) {
    errors.push(`${SUBJECT_LABEL[a.subject]} must be partnered with ${SUBJECT_LABEL[COUNTERPART[a.subject]]}.`);
  }
  if (a.teacherId === b.teacherId) errors.push('A teacher cannot be partnered with themselves.');
  return errors;
}

// Everything that must hold before a group may be published.
export function validateGroupForPublish(g: GroupLite, members: MemberLite[]): string[] {
  const errors = validateClasses(g.classOne, g.classTwo);
  if (members.length === 0) errors.push('The group has no teachers.');
  const byId = new Map(members.map(m => [m.id, m]));
  const seen = new Set<string>();
  for (const m of members) {
    const label = `${SUBJECT_LABEL[m.subject]} (${m.className})`;
    if (!groupHasClass(g, m.className)) errors.push(`${label}: class is not in this group.`);
    const key = `${norm(m.className)}|${m.subject}`;
    if (seen.has(key)) errors.push(`${label}: more than one teacher for the same class and subject.`);
    seen.add(key);
    if (!m.partnerId) { errors.push(`${label}: no designated partner.`); continue; }
    const p = byId.get(m.partnerId);
    if (!p) { errors.push(`${label}: partner is not in this group.`); continue; }
    if (p.partnerId !== m.id) errors.push(`${label}: partnership is not mutual.`);
    errors.push(...validatePartnership(m, p).map(e => `${label}: ${e}`));
  }
  return errors;
}

export type PeerTarget = {
  memberId: string;
  teacherId: string;
  className: string;
  subject: Subject;
  category: Category;
  isPartner: boolean;
};

// Rule 5, steps 3-7: who may this evaluator score through the peer workflow?
// `members` must be the members of ONE published group of the open period.
// An evaluator who is not a member of that group gets nothing.
export function peerTargets(evaluatorId: string, members: MemberLite[], alreadySubmitted: Set<string> = new Set()): PeerTarget[] {
  const mine = members.filter(m => m.teacherId === evaluatorId);
  if (mine.length === 0) return [];
  const out = new Map<string, PeerTarget>();
  for (const me of mine) {
    for (const t of members) {
      if (t.teacherId === evaluatorId) continue;                               // never yourself
      if (categoryOf(t.subject) !== categoryOf(me.subject)) continue;           // same category only
      if (alreadySubmitted.has(t.teacherId)) continue;                          // already submitted
      const key = t.teacherId;
      const isPartner = me.partnerId === t.id;
      const prev = out.get(key);
      if (!prev || (isPartner && !prev.isPartner)) {
        out.set(key, { memberId: t.id, teacherId: t.teacherId, className: t.className, subject: t.subject, category: categoryOf(t.subject), isPartner });
      }
    }
  }
  return [...out.values()];
}

export type PeerCheck = { ok: true; target: PeerTarget } | { ok: false; reason: string };

export function canPeerEvaluate(evaluatorId: string, targetId: string, members: MemberLite[], alreadySubmitted: Set<string> = new Set()): PeerCheck {
  if (evaluatorId === targetId) return { ok: false, reason: 'You cannot evaluate yourself.' };
  const mine = members.filter(m => m.teacherId === evaluatorId);
  if (mine.length === 0) return { ok: false, reason: 'You are not a member of an active group.' };
  if (!members.some(m => m.teacherId === targetId)) return { ok: false, reason: 'That teacher is not in your group.' };
  if (alreadySubmitted.has(targetId)) return { ok: false, reason: 'You already submitted this evaluation.' };
  const t = peerTargets(evaluatorId, members, alreadySubmitted).find(x => x.teacherId === targetId);
  if (!t) return { ok: false, reason: 'That teacher is in a different EXACT / NON-EXACT category.' };
  return { ok: true, target: t };
}

// Rule 3: a student may only be assigned teachers who teach in the student's own class
// (via a published group of the period). Returns the teachers that qualify.
export function teachersForClass(className: string | null | undefined, members: MemberLite[]): MemberLite[] {
  if (!className) return [];
  return members.filter(m => norm(m.className) === norm(className));
}

export function averageOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
