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
export const TK_PREFIX = 'TK_'; // TK has its own set of profiles (an unsaved TK profile starts from the SD one)

export const WEIGHT_PROFILES: string[] = [
  ...WEIGHT_ROLES,
  ...WEIGHT_ROLES.map(r => SD_PREFIX + r),
  ...WEIGHT_ROLES.map(r => TK_PREFIX + r),
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

export const isTkProfile = (id: string) => id.startsWith(TK_PREFIX);
// SD or TK profile (the primary-school sets, as opposed to the shared SMP / SMA set)
export const isSdProfile = (id: string) => id.startsWith(SD_PREFIX) || isTkProfile(id);
export const baseRole = (id: string) => (isSdProfile(id) ? id.slice(SD_PREFIX.length) : id); // both prefixes are 3 characters

// Just the role, e.g. "Principal"
export const roleLabel = (id: string) => ROLE_LABELS[baseRole(id)] || id;
// Role plus school level, e.g. "SD · Principal"
export const profileLabel = (id: string) => `${isTkProfile(id) ? 'TK' : isSdProfile(id) ? 'SD' : 'SMP / SMA'} · ${roleLabel(id)}`;

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
    if (isTkProfile(id)) ids.push(SD_PREFIX + role); // TK starts from SD
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
  const lvl = String(level || '').toUpperCase();
  return lvl === 'TK' ? TK_PREFIX + role : lvl === 'SD' ? SD_PREFIX + role : role;
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
// SD / TK master report. Overall score = Main evaluation + Student + HRD (default 79 / 11 / 10).
// The main evaluation is itself Peer + Self + Supervisor + Leaders (default 10 / 10 / 20 / 60 of main).
//   mainWeight       share of the overall score taken by the main evaluation
//   studentWeight    Student evaluation share of the overall score
//   attendanceWeight HRD share of the overall score
//   peerWeight / selfWeight / supervisorWeight / leaderWeight   split INSIDE the main evaluation (sum 100)
//   observationWeight share of the overall score taken by the observation rubric result (0 = not used)
// ---------------------------------------------------------------------------------------------
export const isSdGroupLevel = (level?: string | null) => ['SD', 'TK'].includes(String(level || '').toUpperCase());

export type FullWeights = {
  studentWeight: number; peerWeight: number; selfWeight: number; observationWeight: number; attendanceWeight: number;
  mainWeight: number; supervisorWeight: number; leaderWeight: number;
};

export const SD_DEFAULT_WEIGHTS: FullWeights = {
  studentWeight: 11, attendanceWeight: 10, mainWeight: 79,
  peerWeight: 10, selfWeight: 10, supervisorWeight: 20, leaderWeight: 60,
  observationWeight: 0,
};

// SMP / SMA now use the same layout as SD / TK, with Observation (the result of the observation rubric) as its own share of the overall score.
// Start: Main 69 + Student 11 + HRD 10 + Observation 10 = 100, and 10 / 10 / 20 / 60 inside the main evaluation.
export const SMP_DEFAULT_WEIGHTS: FullWeights = {
  studentWeight: 11, attendanceWeight: 10, mainWeight: 69, observationWeight: 10,
  peerWeight: 10, selfWeight: 10, supervisorWeight: 20, leaderWeight: 60,
};

// The weights of the cards on a dashboard (Student, Scores from Others, Observation, Attendance).
// With the main layout, "Scores from Others" is the part of the overall score that comes from peers: main x peer share.
export function cardWeights<T extends Partial<FullWeights> | null | undefined>(w: T): T {
  if (!w || !isSdLayout(w as { mainWeight?: number })) return w;
  const x = w as Partial<FullWeights>;
  return { ...x, peerWeight: ((Number(x.mainWeight) || 0) * (Number(x.peerWeight) || 0)) / 100 } as T;
}

// True when a stored profile already uses the SD / TK layout (older profiles have no main weight)
export const isSdLayout = (w: { mainWeight?: number }) => Number(w.mainWeight) > 0;

// Check a profile in the main layout (SD / TK and SMP / SMA). Returns an error message, or null when valid.
export function validateSdWeights(w: Partial<FullWeights>): string | null {
  const n = (v: unknown) => Number(v) || 0;
  const overall = n(w.mainWeight) + n(w.studentWeight) + n(w.attendanceWeight) + n(w.observationWeight);
  const inner = n(w.peerWeight) + n(w.selfWeight) + n(w.supervisorWeight) + n(w.leaderWeight);
  if (overall !== 100) return `Main + Student + HRD + Observation must total 100%. Currently: ${overall}%`;
  if (inner !== 100) return `Peer + Self + Supervisor + Leaders must total 100% of the main evaluation. Currently: ${inner}%`;
  return null;
}

type Scores = {
  student: number; peer: number; self: number; observation: number; attendance: number;
  supervisor?: number; leader?: number; // NaN / undefined = missing
};

const present = (n: number | undefined): n is number => typeof n === 'number' && !isNaN(n);

// Final score on the same 1-4 scale as the components.
//  - Main layout (SD / TK, and SMP / SMA once saved with a main weight): every part must exist (Peer, Self, Supervisor, Leaders, Student, HRD), otherwise the
//    result is "incomplete" and nothing is redistributed. `missing` lists what is absent.
//  - Old profiles without a main weight: unchanged. Missing components are left out and the remaining weights are rescaled.
export function computeFinal(
  profileId: string,
  w: Partial<FullWeights> & { studentWeight: number; peerWeight: number; selfWeight: number; observationWeight: number; attendanceWeight: number },
  s: Scores
): { final: number | null; incomplete: boolean; main: number | null; missing: string[] } {
  if (isSdProfile(profileId) || isSdLayout(w)) {
    const parts: [string, number | undefined, number][] = [
      ['Peer', s.peer, w.peerWeight], ['Self', s.self, w.selfWeight],
      ['Supervisor', s.supervisor, w.supervisorWeight || 0], ['Leaders', s.leader, w.leaderWeight || 0],
    ];
    const missing = parts.filter(([, v]) => !present(v)).map(([name]) => name);
    if (!present(s.student)) missing.push('Student');
    if (!present(s.attendance)) missing.push('HRD');
    const obsWeight = w.observationWeight || 0;
    if (obsWeight > 0 && !present(s.observation)) missing.push('Observation');

    const innerTotal = parts.reduce((a, [, , weight]) => a + weight, 0);
    const main = missing.some(m => ['Peer', 'Self', 'Supervisor', 'Leaders'].includes(m)) || innerTotal <= 0
      ? null
      : parts.reduce((a, [, v, weight]) => a + (v as number) * weight, 0) / innerTotal;

    const mainWeight = w.mainWeight || 0;
    const overallTotal = mainWeight + w.studentWeight + w.attendanceWeight + obsWeight;
    if (missing.length > 0 || main === null || overallTotal <= 0) return { final: null, incomplete: true, main, missing };
    const final = (main * mainWeight + s.student * w.studentWeight + s.attendance * w.attendanceWeight + (obsWeight > 0 ? s.observation * obsWeight : 0)) / overallTotal;
    return { final, incomplete: false, main, missing };
  }

  const items: [number, number][] = [
    [s.student, w.studentWeight], [s.peer, w.peerWeight], [s.self, w.selfWeight],
    [s.observation, w.observationWeight], [s.attendance, w.attendanceWeight],
  ];
  let sum = 0, acc = 0;
  items.forEach(([score, weight]) => { if (present(score)) { sum += weight; acc += score * weight; } });
  return { final: sum > 0 ? acc / sum : null, incomplete: false, main: null, missing: [] };
}
