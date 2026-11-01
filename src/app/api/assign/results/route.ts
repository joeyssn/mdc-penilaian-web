import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';
import { averageOf } from '@/lib/sd/rules';

export const dynamic = 'force-dynamic';

// The logged-in user's own results: what supervisors, peers and the koordinator gave them, kept apart. Hidden while scores are locked.
// ?periodId=... for a specific period, otherwise the open (or latest) one.
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const asked = new URL(req.url).searchParams.get('periodId');
    const period = asked
      ? await prisma.evalPeriod.findUnique({ where: { id: asked } })
      : (await prisma.evalPeriod.findFirst({ where: { status: 'OPEN' } })) ?? (await prisma.evalPeriod.findFirst({ orderBy: { createdAt: 'desc' } }));
    if (!period) return NextResponse.json({ period: null, sources: [] });

    const hide = !SCORE_VIEWER_ROLES.includes(session.role) && (await isScoresLockedFor(session));
    const [evals, assigned] = await Promise.all([
      prisma.sdEvaluation.findMany({ where: { periodId: period.id, targetId: session.id, type: { in: ['SUPERVISOR', 'PEER', 'KOORDINATOR'] } }, select: { type: true, average: true } }),
      prisma.teacherAssignment.findMany({ where: { periodId: period.id, teacherId: session.id, active: true }, select: { role: true } }),
    ]);
    const sources = (['SUPERVISOR', 'PEER', 'KOORDINATOR'] as const).map(type => {
      const list = evals.filter(e => e.type === type);
      return { type, assigned: assigned.filter(a => a.role === type).length, submitted: list.length, average: hide || !list.length ? null : Number(averageOf(list.map(e => e.average)).toFixed(2)) };
    });
    return NextResponse.json({ period: { id: period.id, name: period.name, status: period.status }, locked: hide, sources });
  } catch (e) {
    console.error('ASSIGN RESULTS ERROR', e);
    return NextResponse.json({ error: 'Could not load your results.' }, { status: 500 });
  }
}
