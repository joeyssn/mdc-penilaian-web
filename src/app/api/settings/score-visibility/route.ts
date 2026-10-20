import { NextResponse } from 'next/server';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// Tells the logged-in user whether their own results are visible. Locking is done per cycle: /api/cycles/[id]/lock
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const locked = await isScoresLockedFor(session);
  return NextResponse.json({ locked, visibleToMe: !locked || SCORE_VIEWER_ROLES.includes(session.role) });
}
