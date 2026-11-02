// Pure rules for the extra "who evaluates whom" assignments outside the SD module. No database access, so it can be unit-tested.
//
//  PRINCIPAL_VP     the Director picks which principal evaluates each vice principal (same school)
//  HEAD_WORKERS     the Director picks the head of a division (a Head Management account, or any admin / staff of that team) to evaluate each worker of the same division
//  SCHOOL_TEACHERS  an SMP / SMA principal or vice principal picks supervisor / peer / koordinator for the teachers of their own school
//  KARYAWAN         HRD picks the leader and the peers (all karyawan) of each karyawan
import { normLevel } from '../levelScopeCore.ts';
import { PEER_ACCOUNT_ROLES, LEADER_ACCOUNT_ROLES, type EvaluatorRole } from '../sd/rules.ts';

export type Mode = 'PRINCIPAL_VP' | 'HEAD_WORKERS' | 'SCHOOL_TEACHERS' | 'KARYAWAN';
export const MODES: Mode[] = ['PRINCIPAL_VP', 'HEAD_WORKERS', 'SCHOOL_TEACHERS', 'KARYAWAN'];
// A division head can be a dedicated Head Management account or one of the team itself (admin / staff).
// IT, PR and ACC (accounting) are roles of their own; ADMIN and HRD are also divisions. STAFF takes its division from the Users form.
export const DIVISIONS = ['IT', 'HRD', 'ADMIN', 'PR', 'ACC'] as const;
export const WORKER_ROLES = ['IT', 'PR', 'ACC', 'ADMIN', 'HRD', 'STAFF'];
export const HEAD_ACCOUNT_ROLES = [...WORKER_ROLES, 'HEAD_MANAGEMENT'];
export const normDivision = (d?: string | null) => { const v = (d ?? '').trim().toUpperCase(); return (DIVISIONS as readonly string[]).includes(v) ? v : null; };
// The division a person belongs to: their role when it is a division role, otherwise the Division field.
export const divisionOf = (u: { role: string; division?: string | null }) => normDivision(['IT', 'PR', 'ACC', 'ADMIN', 'HRD'].includes(u.role) ? u.role : u.division);

export const MODE_LABEL: Record<Mode, string> = {
  PRINCIPAL_VP: 'Principal → Vice Principals',
  HEAD_WORKERS: 'Head Management → Workers',
  SCHOOL_TEACHERS: 'Teachers of my school',
  KARYAWAN: 'Karyawan → Karyawan',
};

// Which assignment roles each mode can set.
export const MODE_ROLES: Record<Mode, EvaluatorRole[]> = {
  PRINCIPAL_VP: ['SUPERVISOR', 'PEER'],
  HEAD_WORKERS: ['SUPERVISOR', 'PEER', 'KOORDINATOR'],
  SCHOOL_TEACHERS: ['SUPERVISOR', 'PEER', 'KOORDINATOR'],
  KARYAWAN: ['SUPERVISOR', 'PEER'], // SUPERVISOR = the leader of the karyawan
};

type U = { id?: string; role: string; level?: string | null; division?: string | null };
const VPS = ['VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN'];
const SCHOOLS = ['TK', 'SD', 'SMP', 'SMA']; // every school has its own copy of the teacher wizard

// The modes a logged-in user may use. TK, SD, SMP and SMA each get the same teacher wizard, limited to their own school.
export function modesFor(viewer: U): Mode[] {
  const lvl = normLevel(viewer.level);
  if (viewer.role === 'DIRECTOR') return ['PRINCIPAL_VP', 'HEAD_WORKERS'];
  if (viewer.role === 'HRD') return ['KARYAWAN'];
  if ((viewer.role === 'PRINCIPAL' || VPS.includes(viewer.role)) && lvl && SCHOOLS.includes(lvl)) return ['SCHOOL_TEACHERS'];
  return [];
}

// Is `target` someone this viewer may assign evaluators for, in this mode?
export function isTarget(mode: Mode, viewer: U, target: U): boolean {
  switch (mode) {
    case 'PRINCIPAL_VP': return VPS.includes(target.role) && !!normLevel(target.level);
    case 'HEAD_WORKERS': return WORKER_ROLES.includes(target.role) && !!divisionOf(target);
    case 'SCHOOL_TEACHERS': return target.role === 'TEACHER' && !!normLevel(target.level) && normLevel(target.level) === normLevel(viewer.level);
    case 'KARYAWAN': return target.role === 'KARYAWAN';
  }
}

// Reasons why `evaluator` cannot evaluate `target` with this role in this mode (empty = fine).
// `heads` maps a division to the account the Director chose as its head. When a head is chosen, only that person can be the head evaluator.
export type Heads = Partial<Record<string, string>>;
export function evaluatorErrors(mode: Mode, role: EvaluatorRole, target: U & { id: string }, evaluator: U & { id: string }, heads: Heads = {}): string[] {
  const errs: string[] = [];
  if (!MODE_ROLES[mode].includes(role)) return ['This role cannot be set here.'];
  if (evaluator.id === target.id) return ['Nobody can evaluate themselves.'];
  switch (mode) {
    case 'PRINCIPAL_VP':
      // Peers of a vice principal are other vice principals (any school); the principal evaluator is of the same school.
      if (role === 'PEER') { if (!VPS.includes(evaluator.role) && evaluator.role !== 'HRD') errs.push('A peer of a vice principal must be a vice principal or HRD.'); break; }
      if (evaluator.role !== 'PRINCIPAL') errs.push('Only a principal can evaluate a vice principal.');
      else if (normLevel(evaluator.level) !== normLevel(target.level)) errs.push('The principal must be from the same school as the vice principal.');
      break;
    case 'HEAD_WORKERS':
      if (!HEAD_ACCOUNT_ROLES.includes(evaluator.role)) errs.push('Must be an IT, PR, ACC, admin, HRD or staff account.');
      else if (!divisionOf(evaluator) || divisionOf(evaluator) !== divisionOf(target)) errs.push('Must be in the same division as the worker.');
      else if (role === 'SUPERVISOR' && heads[divisionOf(target)!] && heads[divisionOf(target)!] !== evaluator.id) errs.push('The head of this division was chosen by the Director; only the head can be the head evaluator.');
      break;
    case 'SCHOOL_TEACHERS': {
      const allowed = role === 'PEER' ? PEER_ACCOUNT_ROLES : LEADER_ACCOUNT_ROLES;
      if (!allowed.includes(evaluator.role)) errs.push(`This account cannot be a ${role.toLowerCase()}.`);
      else if (evaluator.role !== 'HRD' && normLevel(evaluator.level) !== normLevel(target.level)) errs.push('The evaluator must be from the same school.'); // HRD is shared by every school
      break;
    }
    case 'KARYAWAN':
      if (evaluator.role !== 'KARYAWAN' && !(role === 'PEER' && evaluator.role === 'HRD')) errs.push(role === 'SUPERVISOR' ? 'Only a karyawan can be the leader of a karyawan.' : 'Only a karyawan or HRD can be a peer of a karyawan.');
      break;
  }
  return errs;
}

// Who can be offered in the picker for a target (same checks as evaluatorErrors, per role).
export const candidatesFor = <T extends U & { id: string }>(mode: Mode, role: EvaluatorRole, target: U & { id: string }, people: T[], heads: Heads = {}) =>
  people.filter(p => evaluatorErrors(mode, role, target, p, heads).length === 0);

// Who may be chosen as the head of a division.
export const headCandidates = <T extends U & { id: string }>(division: string, people: T[]) =>
  people.filter(p => HEAD_ACCOUNT_ROLES.includes(p.role) && divisionOf(p) === division);
