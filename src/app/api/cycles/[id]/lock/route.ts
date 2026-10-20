import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { denyUnlessRole, getSession, SCORE_UNLOCKER_ROLES } from '@/lib/session';

// Lock / unlock results for one cycle. Admin and principal only; recorded with who, when and which cycle.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessRole(SCORE_UNLOCKER_ROLES);
  if (denied) return denied;
  const session = (await getSession())!;
  const { id } = await params;
  const { locked } = await req.json();
  if (typeof locked !== 'boolean') {
    return NextResponse.json({ error: '`locked` must be true or false.' }, { status: 400 });
  }

  const cycle = await prisma.evaluationCycle.findUnique({ where: { id } });
  if (!cycle) return NextResponse.json({ error: 'Cycle not found.' }, { status: 404 });
  if (cycle.status === 'CLOSED') {
    return NextResponse.json({ error: 'This cycle is closed.' }, { status: 409 });
  }
  if (cycle.scoresLocked === locked) return NextResponse.json(cycle);

  const action = locked ? 'LOCKED' : 'UNLOCKED';
  const [updated] = await prisma.$transaction([
    prisma.evaluationCycle.update({ where: { id }, data: { scoresLocked: locked } }),
    prisma.scoreLockEvent.create({
      data: { cycleId: id, action, actorId: session.id, actorName: session.name, actorRole: session.role },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.id, actorName: session.name, actorRole: session.role,
        action: `SCORES_${action}`, entityType: 'EvaluationCycle', entityId: id,
        detail: { cycleName: cycle.name, schoolLevel: cycle.schoolLevel },
      },
    }),
  ]);
  return NextResponse.json(updated);
}
