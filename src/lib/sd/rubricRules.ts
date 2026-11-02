// Which rubric may be used for which kind of SD evaluation. Pure, so it can be unit-tested.
//
// An admin tags a rubric with its evaluators: Peer, Supervisor, Koordinator, Student (or the older generic roles).
// - STUDENT evaluations use a rubric tagged Student.
// - PEER / SUPERVISOR / KOORDINATOR use a rubric tagged with that exact role when one exists.
// - If no rubric is tagged for that role yet, the generic SD teacher rubric (no Peer/Supervisor/Koordinator/Student tag) is used,
//   so everything keeps working until the admin adds a dedicated rubric.
// - If there is no generic rubric either, the rubric assigned to Peer applies to every other role too (then any rubric that is not for students).

export type SdType = 'PEER' | 'SUPERVISOR' | 'KOORDINATOR' | 'STUDENT';
const SPECIAL = ['peer', 'supervisor', 'koordinator'];

const tags = (evaluators: string[] | string | null | undefined): string[] =>
  (Array.isArray(evaluators) ? evaluators : (evaluators ?? '').split(',')).flatMap(s => (s.trim().toLowerCase() === 'director/principal' ? ['director', 'principal'] : [s.trim().toLowerCase()])).filter(Boolean);

// The name Manage Rubrics uses for an account role.
export const roleLabel = (role?: string | null): string => {
  const r = String(role ?? '').toUpperCase();
  if (r.startsWith('VICE_PRINCIPAL')) return 'Vice-Principal';
  return ({ TEACHER: 'Teacher', STAFF: 'Staff', KARYAWAN: 'Karyawan', PRINCIPAL: 'Principal', DIRECTOR: 'Director', HRD: 'HRD', IT: 'IT', PR: 'PR', ACC: 'ACC', ADMIN: 'Admin', STUDENT: 'Student' } as Record<string, string>)[r] ?? r;
};
export type RoleCtx = { evaluatorRole?: string | null; targetRole?: string | null };

type R = { id: string; evaluators?: string[] | string | null; evaluatees?: string[] | string | null };

export function eligibleRubrics<T extends R>(type: SdType, rubrics: T[], ctx?: RoleCtx): T[] {
  // 1. The rubric the admin assigned in Manage Rubrics to this evaluator role scoring this target role
  //    (e.g. a teacher scoring a teacher = peer assessment uses the Teacher -> Teacher rubric), whoever assigned the evaluator.
  if (ctx?.evaluatorRole && ctx?.targetRole) {
    const ev = roleLabel(ctx.evaluatorRole).toLowerCase(), tg = roleLabel(ctx.targetRole).toLowerCase();
    const pair = rubrics.filter(r => tags(r.evaluators).includes(ev) && tags(r.evaluatees).includes(tg));
    if (pair.length) {
      const own = type.toLowerCase();
      const tagged = pair.filter(r => tags(r.evaluators).includes(own));
      if (tagged.length) return tagged;
      const plain = pair.filter(r => !tags(r.evaluators).some(t => SPECIAL.includes(t)));
      return plain.length ? plain : pair;
    }
  }
  if (type === 'STUDENT') return rubrics.filter(r => tags(r.evaluators).includes('student'));
  const own = type.toLowerCase();
  const usable = rubrics.filter(r => !tags(r.evaluators).includes('student'));
  const dedicated = usable.filter(r => tags(r.evaluators).includes(own));
  if (dedicated.length) return dedicated;
  const generic = usable.filter(r => !tags(r.evaluators).some(t => SPECIAL.includes(t)));
  if (generic.length) return generic;
  // Nothing is tagged for this role and there is no general rubric: the rubric the admin assigned to Peer applies to the other roles too.
  const peer = usable.filter(r => tags(r.evaluators).includes('peer'));
  return peer.length ? peer : usable;
}

export const isRubricAllowed = (type: SdType, rubricId: string, rubrics: R[], ctx?: RoleCtx) => eligibleRubrics(type, rubrics, ctx).some(r => r.id === rubricId);
