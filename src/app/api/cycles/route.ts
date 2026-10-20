import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { denyUnlessRole, getSession, SCORE_UNLOCKER_ROLES } from '@/lib/session';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const LEVELS = ['SD', 'SMP', 'SMA'];

// List cycles with their lock history (admin / principal / director only)
export async function GET() {
  const denied = await denyUnlessRole([...SCORE_UNLOCKER_ROLES, 'DIRECTOR']);
  if (denied) return denied;
  const cycles = await prisma.evaluationCycle.findMany({
    orderBy: { createdAt: 'desc' },
    include: { lockEvents: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  return NextResponse.json(cycles);
}

// Create a cycle (admin only). New cycles start locked.
export async function POST(req: Request) {
  const denied = await denyUnlessRole(['ADMIN']);
  if (denied) return denied;
  const session = (await getSession())!;
  const { name, schoolLevel } = await req.json();
  const level = String(schoolLevel || '').toUpperCase();
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Cycle name is required.' }, { status: 400 });
  }
  if (!LEVELS.includes(level)) {
    return NextResponse.json({ error: 'School level must be SD, SMP, or SMA.' }, { status: 400 });
  }
  const duplicate = await prisma.evaluationCycle.findFirst({ where: { schoolLevel: level, status: 'OPEN' } });
  if (duplicate) {
    return NextResponse.json({ error: `There is already an open ${level} cycle ("${duplicate.name}"). Close it first.` }, { status: 409 });
  }
  const cycle = await prisma.evaluationCycle.create({ data: { name: name.trim(), schoolLevel: level } });
  await writeAudit(session, 'CYCLE_CREATED', 'EvaluationCycle', cycle.id, { name: cycle.name, schoolLevel: level });
  return NextResponse.json(cycle, { status: 201 });
}
