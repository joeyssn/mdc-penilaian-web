import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, openPeriod } from '@/lib/sd/access';
import { getSession } from '@/lib/session';
import { normLevel } from '@/lib/levelScopeCore';

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

  // Students: their class teachers (added automatically) plus any the Vice Principal assigned
  if (session.role === 'STUDENT') {
    // A student with no assignments yet gets the teachers of their own class (same school, same class name).
    // The Vice Principal can still change the list afterwards from Student Assignments.
    const existing = await prisma.studentAssignment.count({ where: { periodId: period.id, studentId: session.id } });
    if (existing === 0) {
      const me = await prisma.user.findUnique({ where: { id: session.id }, select: { className: true, level: true } });
      const cls = (me?.className ?? '').trim().toUpperCase(), lvl = normLevel(me?.level);
      if (cls && lvl) {
        const teachers = await prisma.user.findMany({ where: { role: 'TEACHER' }, select: { id: true, className: true, level: true } });
        const mates = teachers.filter(t => (t.className ?? '').trim().toUpperCase() === cls && normLevel(t.level) === lvl);
        if (mates.length) await prisma.studentAssignment.createMany({
          data: mates.map(t => ({ periodId: period.id, studentId: session.id, teacherId: t.id, assignedById: 'AUTO-CLASS' })),
          skipDuplicates: true,
        });
      }
    }
    const st = await prisma.studentAssignment.findMany({ where: { periodId: period.id, studentId: session.id }, include: { teacher: { select: { id: true, name: true } } } });
    for (const a of st) (isDone('STUDENT', a.teacherId) ? out.STUDENT.submitted : out.STUDENT.pending).push({ teacherId: a.teacher.id, name: a.teacher.name });
  }
  return NextResponse.json(out);
}
