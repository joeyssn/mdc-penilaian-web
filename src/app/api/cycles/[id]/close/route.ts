import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { denyUnlessRole, getSession } from '@/lib/session';
import { writeAudit } from '@/lib/audit';

// Close a cycle (admin only). Closed cycles are kept for history and can't be reopened here.
export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessRole(['ADMIN']);
  if (denied) return denied;
  const session = (await getSession())!;
  const { id } = await params;
  const cycle = await prisma.evaluationCycle.findUnique({ where: { id } });
  if (!cycle) return NextResponse.json({ error: 'Cycle not found.' }, { status: 404 });
  if (cycle.status === 'CLOSED') return NextResponse.json(cycle);
  const updated = await prisma.evaluationCycle.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
  await writeAudit(session, 'CYCLE_CLOSED', 'EvaluationCycle', id, { cycleName: cycle.name, schoolLevel: cycle.schoolLevel });
  return NextResponse.json(updated);
}
