// Pure school-scope rules (no database), so they can be unit-tested.
export type SessionLike = { role: string; level?: string | null };

// The institute has four schools. Each has its own principal, vice principals, staff, admin and karyawan.
// HRD, the director and an ADMIN without a level are shared / global.
export const LEVELS = ['TK', 'SD', 'SMP', 'SMA'] as const;
export type Level = (typeof LEVELS)[number];

const BOUND_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'STAFF', 'KARYAWAN', 'ADMIN'];

export const normLevel = (l?: string | null): Level | null => {
  const v = (l ?? '').trim().toUpperCase();
  return (LEVELS as readonly string[]).includes(v) ? (v as Level) : null;
};

// The one school this viewer is limited to, or null when they see every school.
// Accounts that have no level yet stay global, so nothing disappears until a level is set on them.
export function scopeOf(user: SessionLike | null | undefined): Level | null {
  if (!user || !BOUND_ROLES.includes(user.role)) return null;
  return normLevel(user.level);
}

export const inScope = (scope: Level | null, userLevel?: string | null) => scope === null || normLevel(userLevel) === scope;

