import { NextResponse } from 'next/server';
import { denyUnlessRole, getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLocked, setScoresLocked } from '@/lib/settings';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Any logged-in user can ask whether their own results are visible.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const locked = await isScoresLocked();
  return NextResponse.json({ locked, visibleToMe: !locked || SCORE_VIEWER_ROLES.includes(session.role) });
}

// Only an admin can lock or unlock. Every change is written to the audit log (who and when).
export async function PUT(req: Request) {
  const denied = await denyUnlessRole(['ADMIN']);
  if (denied) return denied;
  const session = (await getSession())!;
  const { locked } = await req.json();
  if (typeof locked !== 'boolean') {
    return NextResponse.json({ error: '`locked` must be true or false.' }, { status: 400 });
  }
  const before = await isScoresLocked();
  await setScoresLocked(locked);
  if (before !== locked) await writeAudit(session, locked ? 'SCORES_LOCKED' : 'SCORES_UNLOCKED', 'AppSetting', 'scoresLocked');
  return NextResponse.json({ locked });
}
