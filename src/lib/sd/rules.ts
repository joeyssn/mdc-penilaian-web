// Pure business rules for the SD / TK evaluation assignments. No database access here,
// so every rule can be unit-tested. The API routes load data and call these.
//
// How it works: the principal clicks a teacher and picks who supervises, who is a peer and who is the koordinator.
// There are no groups, classes or categories to match any more.

export type EvaluatorRole = 'SUPERVISOR' | 'PEER' | 'KOORDINATOR';
export const EVALUATOR_ROLES: EvaluatorRole[] = ['SUPERVISOR', 'PEER', 'KOORDINATOR'];

export const ROLE_LABEL: Record<EvaluatorRole, string> = { SUPERVISOR: 'Supervisor', PEER: 'Peer', KOORDINATOR: 'Koordinator' };

// Account roles that may be picked for each assignment role.
export const PEER_ACCOUNT_ROLES = ['TEACHER'];
export const LEADER_ACCOUNT_ROLES = ['TEACHER']; // supervisors and koordinators are teachers too
export const accountRolesFor = (role: EvaluatorRole) => (role === 'PEER' ? PEER_ACCOUNT_ROLES : LEADER_ACCOUNT_ROLES);

export function validateAssignment(teacherId: string, evaluator: { id: string; role: string }, role: EvaluatorRole): string[] {
  const errors: string[] = [];
  if (!EVALUATOR_ROLES.includes(role)) errors.push('Unknown evaluator role.');
  if (evaluator.id === teacherId) errors.push('A teacher cannot evaluate themselves.');
  else if (!accountRolesFor(role).includes(evaluator.role)) errors.push(`This account cannot be a ${ROLE_LABEL[role] ?? 'evaluator'}.`);
  return errors;
}

// Turn "this is the list I want" into what has to change. Evaluators that already submitted are kept as history (deactivated), never deleted.
export function diffAssignments(existing: { evaluatorId: string; active: boolean; hasEvaluations: boolean }[], wanted: string[]) {
  const want = new Set(wanted);
  const have = new Map(existing.map(e => [e.evaluatorId, e]));
  return {
    toCreate: wanted.filter(id => !have.has(id)),
    toReactivate: wanted.filter(id => have.get(id) && !have.get(id)!.active),
    toDelete: existing.filter(e => !want.has(e.evaluatorId) && !e.hasEvaluations).map(e => e.evaluatorId),
    toDeactivate: existing.filter(e => !want.has(e.evaluatorId) && e.hasEvaluations && e.active).map(e => e.evaluatorId),
  };
}

// An evaluator may submit only when an active assignment of exactly that type exists.
export function canSubmit(type: string, assignment: { active: boolean; role: string } | null | undefined): boolean {
  return !!assignment && assignment.active && assignment.role === type;
}

export function averageOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Leaders component: the average of the leader inputs that exist (principal / vice principal observation, koordinator evaluation).
export function leaderScore(observation: number, koordinator: number): number {
  const present = [observation, koordinator].filter(v => Number.isFinite(v));
  return present.length ? averageOf(present) : NaN;
}
