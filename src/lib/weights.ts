// Weight profiles. SMP/SMA share one set of per-role profiles. SD has its own full set
// (its own principal, vice principals, HRD, staff, ...) because it is scored differently.
//   id "PRINCIPAL"    -> SMP / SMA principal
//   id "SD_PRINCIPAL" -> SD principal
export type WeightProfile = {
  id: string;
  studentWeight: number;
  peerWeight: number;
  selfWeight: number;
  observationWeight: number;
  attendanceWeight: number;
};

export const WEIGHT_ROLES = [
  'TEACHER',
  'VICE_PRINCIPAL_KURIKULUM',
  'VICE_PRINCIPAL_KESISWAAN',
  'PRINCIPAL',
  'DIRECTOR',
  'STAFF',
  'HRD',
  'KARYAWAN',
] as const;

export const SD_PREFIX = 'SD_';

export const WEIGHT_PROFILES: string[] = [
  ...WEIGHT_ROLES,
  ...WEIGHT_ROLES.map(r => SD_PREFIX + r),
];

export const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher',
  VICE_PRINCIPAL_KURIKULUM: 'Vice Principal (Kurikulum)',
  VICE_PRINCIPAL_KESISWAAN: 'Vice Principal (Kesiswaan)',
  PRINCIPAL: 'Principal',
  DIRECTOR: 'Director',
  STAFF: 'Staff',
  HRD: 'HRD',
  KARYAWAN: 'Karyawan',
};

export const isSdProfile = (id: string) => id.startsWith(SD_PREFIX);
export const baseRole = (id: string) => (isSdProfile(id) ? id.slice(SD_PREFIX.length) : id);

// Just the role, e.g. "Principal"
export const roleLabel = (id: string) => ROLE_LABELS[baseRole(id)] || id;
// Role plus school level, e.g. "SD · Principal"
export const profileLabel = (id: string) => `${isSdProfile(id) ? 'SD' : 'SMP / SMA'} · ${roleLabel(id)}`;

// Profiles saved by older versions. They are only a starting point / fallback until the admin
// saves the full set, which replaces them.
export const LEGACY_PROFILE_IDS = [
  'Teacher', 'Staff', 'Karyawan', 'Vice-Principal', 'Director/Principal', // original five groups
  'TEACHER_SD', 'TEACHER_SMP_SMA',                                         // short-lived teacher split
];

function legacyGroup(role: string): string {
  if (role === 'TEACHER') return 'Teacher';
  if (role === 'STAFF' || role === 'HRD') return 'Staff';
  if (role === 'KARYAWAN') return 'Karyawan';
  if (role.startsWith('VICE_PRINCIPAL')) return 'Vice-Principal';
  return 'Director/Principal';
}

// Where a profile gets its values from when it has not been saved yet, most specific first.
// An unsaved SD profile uses the SMP/SMA profile for the same role.
export function fallbackIds(id: string): string[] {
  const role = baseRole(id);
  const ids: string[] = [];
  if (isSdProfile(id)) {
    if (role === 'TEACHER') ids.push('TEACHER_SD');
    ids.push(role);
  }
  if (role === 'TEACHER') ids.push('TEACHER_SMP_SMA');
  ids.push(legacyGroup(role));
  return ids;
}

// Which profile applies to a user: SD users (school level SD) use the SD set, everyone else the SMP/SMA set.
export function profileIdFor(dbRole?: string | null, level?: string | null): string {
  const upper = (dbRole || '').toUpperCase();
  const role = (WEIGHT_ROLES as readonly string[]).includes(upper) ? upper : 'STAFF';
  return isSdGroupLevel(level) ? SD_PREFIX + role : role;
}

export function resolveProfile<T extends { id: string }>(
  profiles: T[],
  dbRole?: string | null,
  level?: string | null
): T | null {
  const id = profileIdFor(dbRole, level);
  for (const candidate of [id, ...fallbackIds(id)]) {
    const found = profiles.find(p => p.id === candidate);
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// SD / TK use a different, 3-part master report: Student + HRD + (Peer & Self reflection combined).
// The existing columns are reused so nothing in the database changes:
//   peerWeight       = the combined "Peer & Self" weight
//   attendanceWeight = HRD
//   selfWeight and observationWeight stay 0.
// ---------------------------------------------------------------------------------------------
export const isSdGroupLevel = (level?: string | null) => ['SD', 'TK'].includes(String(level || '').toUpperCase());

export const SD_DEFAULT_WEIGHTS = {
  studentWeight: 34, peerWeight: 33, selfWeight: 0, observationWeight: 0, attendanceWeight: 33,
};

// True when a stored profile already follows the 3-part layout
export const isThreePartWeights = (w: { selfWeight?: number; observationWeight?: number }) =>
  !Number(w.selfWeight) && !Number(w.observationWeight);

type Weights = {
  studentWeight: number; peerWeight: number; selfWeight: number; observationWeight: number; attendanceWeight: number;
};
type Scores = { student: number; peer: number; self: number; observation: number; attendance: number }; // NaN = missing

const present = (n: number) => typeof n === 'number' && !isNaN(n);

// Final score on the same 1-4 scale as the components.
//  - SD / TK: Student, HRD and Peer & Self must all exist, otherwise the result is "incomplete"
//    (no weights are redistributed). Peer & Self is the average of whichever of the two exists.
//  - SMP / SMA: unchanged. Missing components are left out and the remaining weights are rescaled.
export function computeFinal(
  profileId: string,
  w: Weights,
  s: Scores
): { final: number | null; incomplete: boolean; peerSelf: number | null } {
  if (isSdProfile(profileId)) {
    const parts = [s.peer, s.self].filter(present);
    const peerSelf = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
    if (!present(s.student) || !present(s.attendance) || peerSelf === null) {
      return { final: null, incomplete: true, peerSelf };
    }
    const total = w.studentWeight + w.peerWeight + w.attendanceWeight;
    if (total <= 0) return { final: null, incomplete: true, peerSelf };
    const final = (s.student * w.studentWeight + peerSelf * w.peerWeight + s.attendance * w.attendanceWeight) / total;
    return { final, incomplete: false, peerSelf };
  }

  const items: [number, number][] = [
    [s.student, w.studentWeight], [s.peer, w.peerWeight], [s.self, w.selfWeight],
    [s.observation, w.observationWeight], [s.attendance, w.attendanceWeight],
  ];
  let sum = 0, acc = 0;
  items.forEach(([score, weight]) => { if (present(score)) { sum += weight; acc += score * weight; } });
  return { final: sum > 0 ? acc / sum : null, incomplete: false, peerSelf: null };
}
