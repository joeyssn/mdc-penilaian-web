// Pure rules for the extra "who evaluates whom" assignments outside the SD module. No database access, so it can be unit-tested.
//
//  PRINCIPAL_VP     the Director picks which principal evaluates each vice principal (same school)
//  HEAD_WORKERS     the Director picks the head of a division (a Head Management account, or any admin / staff of that team) to evaluate each worker of the same division
//  SCHOOL_TEACHERS  an SMP / SMA principal or vice principal picks supervisor / peer / koordinator for the teachers of their own school
//  KARYAWAN         HRD picks which karyawan evaluate each karyawan
import { normLevel } from '../levelScopeCore.ts';
import { PEER_ACCOUNT_ROLES, LEADER_ACCOUNT_ROLES, type EvaluatorRole } from '../sd/rules.ts';

export type Mode = 'PRINCIPAL_VP' | 'HEAD_WORKERS' | 'SCHOOL_TEACHERS' | 'KARYAWAN';
export const MODES: Mode[] = ['PRINCIPAL_VP', 'HEAD_WORKERS', 'SCHOOL_TEACHERS', 'KARYAWAN'];
// A division head can be a dedicated Head Management account or one of the team itself (admin / staff).
export const HEAD_ACCOUNT_ROLES = ['HEAD_MANAGEMENT', 'ADMIN', 'STAFF'];
export const DIVISIONS = ['IT', 'HRD', 'ADMIN', 'PR'] as const;
export const normDivision = (d?: string | null) => { const v = (d ?? '').trim().toUpperCase(); return (DIVISIONS as readonly string[]).includes(v) ? v : null; };

export const MODE_LABEL: Record<Mode, string> = {
  PRINCIPAL_VP: 'Principal → Vice Principals',
  HEAD_WORKERS: 'Head Management → Workers',
  SCHOOL_TEACHERS: 'Teachers of my school',
  KARYAWAN: 'Karyawan → Karyawan',
};

// Which assignment roles each mode can set.
export const MODE_ROLES: Record<Mode, EvaluatorRole[]> = {
  PRINCIPAL_VP: ['SUPERVISOR'],
  HEAD_WORKERS: ['SUPERVISOR', 'PEER', 'KOORDINATOR'],
  SCHOOL_TEACHERS: ['SUPERVISOR', 'PEER', 'KOORDINATOR'],
  KARYAWAN: ['PEER'],
};

type U = { id?: string; role: string; level?: string | null; division?: string | null };
const VPS = ['VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN'];
const SMP_SMA = ['SMP', 'SMA'];

// The modes a logged-in user may use. TK and SD keep using the SD module for teachers.
export function modesFor(viewer: U): Mode[] {
  const lvl = normLevel(viewer.level);
  if (viewer.role === 'DIRECTOR') return ['PRINCIPAL_VP', 'HEAD_WORKERS'];
  if (viewer.role === 'HRD') return ['KARYAWAN'];
  if ((viewer.role === 'PRINCIPAL' || VPS.includes(viewer.role)) && lvl && SMP_SMA.includes(lvl)) return ['SCHOOL_TEACHERS'];
  return [];
}

// Is `target` someone this viewer may assign evaluators for, in this mode?
export function isTarget(mode: Mode, viewer: U, target: U): boolean {
  switch (mode) {
    case 'PRINCIPAL_VP': return VPS.includes(target.role) && !!normLevel(target.level);
    case 'HEAD_WORKERS': return ['ADMIN', 'STAFF'].includes(target.role) && !!normDivision(target.division);
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
      if (evaluator.role !== 'PRINCIPAL') errs.push('Only a principal can evaluate a vice principal.');
      else if (normLevel(evaluator.level) !== normLevel(target.level)) errs.push('The principal must be from the same school as the vice principal.');
      break;
    case 'HEAD_WORKERS':
      if (!HEAD_ACCOUNT_ROLES.includes(evaluator.role)) errs.push('Must be a Head Management, admin or staff account.');
      else if (!normDivision(evaluator.division) || normDivision(evaluator.division) !== normDivision(target.division)) errs.push('Must be in the same division as the worker.');
      else if (role === 'SUPERVISOR' && heads[normDivision(target.division)!] && heads[normDivision(target.division)!] !== evaluator.id) errs.push('The head of this division was chosen by the Director; only the head can be the head evaluator.');
      break;
    case 'SCHOOL_TEACHERS': {
      const allowed = role === 'PEER' ? PEER_ACCOUNT_ROLES : LEADER_ACCOUNT_ROLES;
      if (!allowed.includes(evaluator.role)) errs.push(`This account cannot be a ${role.toLowerCase()}.`);
      else if (normLevel(evaluator.level) !== normLevel(target.level)) errs.push('The evaluator must be from the same school.');
      break;
    }
    case 'KARYAWAN':
      if (evaluator.role !== 'KARYAWAN') errs.push('Only a karyawan can evaluate a karyawan.');
      break;
  }
  return errs;
}

// Who can be offered in the picker for a target (same checks as evaluatorErrors, per role).
export const candidatesFor = <T extends U & { id: string }>(mode: Mode, role: EvaluatorRole, target: U & { id: string }, people: T[], heads: Heads = {}) =>
  people.filter(p => evaluatorErrors(mode, role, target, p, heads).length === 0);

// Who may be chosen as the head of a division.
export const headCandidates = <T extends U & { id: string }>(division: string, people: T[]) =>
  people.filter(p => HEAD_ACCOUNT_ROLES.includes(p.role) && normDivision(p.division) === division);
