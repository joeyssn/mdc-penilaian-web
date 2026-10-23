import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, openPeriod } from '@/lib/sd/access';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Everything the logged-in user may evaluate right now, split by source. Each person sees only their own tasks.
export async function GET() {
  const session = await getSession();
  if (!session) return fail('Not authenticated', 401);
  const period = await openPeriod();
  const empty = {
    period: null as any,
    PEER: { pending: [] as any[], submitted: [] as any[] },
    SUPERVISOR: { pending: [] as any[], submitted: [] as any[] },
    KOORDINATOR: { pending: [] as any[], submitted: [] as any[] },
    STUDENT: { pending: [] as any[], submitted: [] as any[] },
    myEvaluators: { SUPERVISOR: [] as string[], PEER: [] as string[], KOORDINATOR: [] as string[] },
  };
  if (!period) return NextResponse.json(empty);
  const out = { ...empty, period: { id: period.id, name: period.name } };

  const done = await prisma.sdEvaluation.findMany({ where: { periodId: period.id, evaluatorId: session.id }, select: { type: true, targetId: true } });
  const isDone = (type: string, targetId: string) => done.some(d => d.type === type && d.targetId === targetId);

  // Assigned by the principal: supervisor / peer / koordinator
  const mine = await prisma.teacherAssignment.findMany({
    where: { periodId: period.id, evaluatorId: session.id, active: true },
    include: { teacher: { select: { id: true, name: true } } },
  });
  for (const a of mine) {
    const row = { teacherId: a.teacher.id, name: a.teacher.name };
    (isDone(a.role, a.teacherId) ? out[a.role].submitted : out[a.role].pending).push(row);
  }

  // Who evaluates me (teachers only)
  if (session.role === 'TEACHER') {
    const about = await prisma.teacherAssignment.findMany({ where: { periodId: period.id, teacherId: session.id, active: true }, include: { evaluator: { select: { name: true } } } });
    for (const a of about) out.myEvaluators[a.role].push(a.evaluator.name);
  }

  // Students: only teachers the Vice Principal assigned to this student
  if (session.role === 'STUDENT') {
    const st = await prisma.studentAssignment.findMany({ where: { periodId: period.id, studentId: session.id }, include: { teacher: { select: { id: true, name: true } } } });
    for (const a of st) (isDone('STUDENT', a.teacherId) ? out.STUDENT.submitted : out.STUDENT.pending).push({ teacherId: a.teacher.id, name: a.teacher.name });
  }
  return NextResponse.json(out);
}
