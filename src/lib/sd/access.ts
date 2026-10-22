import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, type SessionUser } from '@/lib/session';
import { isSdGroupLevel } from '@/lib/weights';
import { scopeOf, type Level } from '@/lib/levelScope';

// Who may do what in the SD teacher evaluation system. "Admin SD" is the existing ADMIN role.
export const GROUP_MANAGE_ROLES = ['PRINCIPAL', 'ADMIN'];
export const SD_VIEW_ROLES = ['PRINCIPAL', 'ADMIN', 'DIRECTOR', 'VICE_PRINCIPAL_KESISWAAN'];
export const SUPERVISOR_ELIGIBLE_ROLES = ['TEACHER', 'STAFF', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN'];

// Sensitive actions belong to the Principal. The Principal can delegate them to Admin SD with these switches.
export type SdPermission = 'publish' | 'supervisors' | 'periods';
const KEY = (p: SdPermission) => `sdAdmin_${p}`;

export async function adminPermissions(): Promise<Record<SdPermission, boolean>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: (['publish', 'supervisors', 'periods'] as SdPermission[]).map(KEY) } } });
  const on = (p: SdPermission) => rows.find(r => r.key === KEY(p))?.value === 'true';
  return { publish: on('publish'), supervisors: on('supervisors'), periods: on('periods') };
}

export async function setAdminPermission(p: SdPermission, value: boolean) {
  await prisma.appSetting.upsert({
    where: { key: KEY(p) }, update: { value: String(value) }, create: { key: KEY(p), value: String(value) },
  });
}

export async function can(session: SessionUser, p: SdPermission): Promise<boolean> {
  if (session.role === 'PRINCIPAL') return true;
  if (session.role === 'ADMIN') return (await adminPermissions())[p];
  return false;
}

// The SD teacher evaluation system belongs to TK and SD. A principal / admin of SMP or SMA has no access to it.
export const SD_SCHOOLS: Level[] = ['TK', 'SD'];
const wrongSchool = (s: SessionUser) => { const sc = scopeOf(s); return sc !== null && !SD_SCHOOLS.includes(sc); };
export const schoolOf = (s: SessionUser) => scopeOf(s); // null = sees TK and SD

type Guard = { session: SessionUser; error?: undefined } | { session?: undefined; error: NextResponse };

export async function requireRole(roles: string[]): Promise<Guard> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!roles.includes(session.role)) return { error: NextResponse.json({ error: 'You do not have permission to do this.' }, { status: 403 }) };
  if (wrongSchool(session)) return { error: NextResponse.json({ error: 'This system is only for TK and SD.' }, { status: 403 }) };
  return { session };
}

export async function requirePermission(p: SdPermission): Promise<Guard> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (wrongSchool(session)) return { error: NextResponse.json({ error: 'This system is only for TK and SD.' }, { status: 403 }) };
  if (!(await can(session, p))) return { error: NextResponse.json({ error: `You do not have the "${p}" permission.` }, { status: 403 }) };
  return { session };
}

export const fail = (error: string | string[], status = 400) =>
  NextResponse.json({ error: Array.isArray(error) ? error.join(' ') : error, errors: Array.isArray(error) ? error : [error] }, { status });

// The period evaluations currently run in: the single OPEN period, if any.
export const openPeriod = () => prisma.evalPeriod.findFirst({ where: { status: 'OPEN' } });

// Members of every PUBLISHED group of a period, keyed by group.
// `scope` limits the result to one school's groups (groups without a school label stay visible).
export const groupScopeWhere = (scope: Level | null) => (scope ? { OR: [{ level: scope }, { level: null }] } : {});

export async function publishedMembers(periodId: string, scope: Level | null = null) {
  return prisma.groupMember.findMany({
    where: { group: { periodId, status: 'PUBLISHED', ...groupScopeWhere(scope) } },
    include: { group: { select: { id: true, classOne: true, classTwo: true, name: true } }, teacher: { select: { id: true, name: true, role: true, level: true } } },
  });
}

export const isSdUser = (u: { level?: string | null }) => isSdGroupLevel(u.level);
