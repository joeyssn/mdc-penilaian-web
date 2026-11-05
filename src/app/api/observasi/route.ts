import { filterRowsByUserScope, scopeOf, inScope } from '@/lib/levelScope';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // While scores are locked, only admin/director see everything. Observers (principal / vice
    // principals) still see the observations they wrote, but never ones about themselves.
    let where = {};
    if (!SCORE_VIEWER_ROLES.includes(session.role) && (await isScoresLockedFor(session))) {
      where = { observerId: session.id, NOT: { targetId: session.id } };
    }

    const observations = await prisma.observation.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(await filterRowsByUserScope(scopeOf(session), observations, o => o.targetId));
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch observations" }, { status: 500 });
  }
}

const OBSERVER_ROLES = ['ADMIN', 'DIRECTOR', 'PRINCIPAL', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN'];
const APPROVER_ROLES = ['ADMIN', 'PRINCIPAL']; // only these may approve / disapprove

const deny = (m: string, status = 403) => NextResponse.json({ error: m }, { status });

// A principal may only handle observations of teachers in their own school.
async function inMyScope(session: { role: string; level?: string | null; id: string }, targetId: string) {
  const sc = scopeOf(session as any);
  if (!sc) return true;
  const u = await prisma.user.findUnique({ where: { id: targetId }, select: { level: true } });
  return !!u && inScope(sc, u.level);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return deny('Not authenticated', 401);
    if (!OBSERVER_ROLES.includes(session.role)) return deny('You do not have permission to do this.');
    const { id: _id, isApproved: _ap, observerId: _o, observerName: _on, ...data } = await req.json();
    // The observer is always the logged-in user, and a new observation always starts as not approved.
    const newObs = await prisma.observation.create({ data: { ...data, observerId: session.id, observerName: session.name, isApproved: false } });
    return NextResponse.json(newObs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save observation" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) return deny('Not authenticated', 401);
    const { id, observerId: _o, observerName: _on, ...updateData } = await req.json();
    const current = await prisma.observation.findUnique({ where: { id } });
    if (!current) return deny('Observation not found.', 404);

    const canApprove = APPROVER_ROLES.includes(session.role) && (await inMyScope(session, current.targetId));
    if ('isApproved' in updateData && !canApprove) return deny('Only the principal or admin can approve or disapprove an observation.');

    const isOwner = current.observerId === session.id;
    const changesContent = Object.keys(updateData).some(k => k !== 'isApproved');
    if (changesContent && !(isOwner || session.role === 'ADMIN')) return deny('You can only edit your own observations.');
    // Editing the content of an approved observation sends it back for approval.
    if (changesContent && !('isApproved' in updateData)) (updateData as any).isApproved = false;

    const updatedObs = await prisma.observation.update({ where: { id }, data: updateData });
    return NextResponse.json(updatedObs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update observation" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return deny('Not authenticated', 401);
    const { id } = await req.json();
    const current = await prisma.observation.findUnique({ where: { id } });
    if (!current) return deny('Observation not found.', 404);
    const ok = session.role === 'ADMIN' || current.observerId === session.id || (session.role === 'PRINCIPAL' && (await inMyScope(session, current.targetId)));
    if (!ok) return deny('You cannot delete this observation.');
    await prisma.observation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete observation" }, { status: 500 });
  }
}
