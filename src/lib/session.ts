import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/signedSession';

export type SessionUser = { id: string; name: string; role: string; level?: string | null };

// Reads the logged-in user from the `user_session` cookie set by /api/login.
export async function getSession(): Promise<SessionUser | null> {
  const parsed = await verifySession((await cookies()).get('user_session')?.value);
  if (!parsed?.id || !parsed?.role) return null;
  return { id: parsed.id, name: parsed.name, role: String(parsed.role).toUpperCase(), level: parsed.level ?? null };
}

// Roles that may see every score regardless of the lock.
export const SCORE_VIEWER_ROLES = ['ADMIN', 'DIRECTOR'];
// Roles that may create / edit / delete rubric content and weights.
export const RUBRIC_EDITOR_ROLES = ['ADMIN', 'DIRECTOR'];
// Roles that may lock / unlock scores for an evaluation cycle.
export const SCORE_UNLOCKER_ROLES = ['ADMIN', 'PRINCIPAL'];
// Roles that may only assign rubrics (evaluators / evaluatees).
export const RUBRIC_ASSIGNER_ROLES = ['ADMIN', 'DIRECTOR', 'PRINCIPAL'];

// Returns an error response if the caller isn't logged in or lacks one of the roles, otherwise null.
export async function denyUnlessRole(roles: string[]): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: 'You do not have permission to do this.' }, { status: 403 });
  }
  return null;
}
