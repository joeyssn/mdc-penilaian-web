import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, openPeriod } from '@/lib/sd/access';
import { getSession } from '@/lib/session';
import { normLevel } from '@/lib/levelScopeCore';

export const dynamic = 'force-dynamic';

const schoolGroup = (level?: string | null) => { const l = normLevel(level); return l === 'TK' || l === 'SD' ? 'SD' : 'SMP_SMA'; };

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
    include: { teacher: { select: { id: true, name: true, level: true, role: true } } },
  });
  for (const a of mine) {
    // school = which system the teacher belongs to, so TK / SD and SMP / SMA evaluations never mix on one screen
    const row = { teacherId: a.teacher.id, name: a.teacher.name, role: a.teacher.role, school: schoolGroup(a.teacher.level) };
    (isDone(a.role, a.teacherId) ? out[a.role].submitted : out[a.role].pending).push(row);
  }

  // Students: their class teachers (added automatically) plus any the Vice Principal assigned
  if (session.role === 'STUDENT') {
    // Class teachers follow the student's CURRENT class (same school, same class name), so changing a class updates the list.
    // Only rows created here (assignedById = 'AUTO-CLASS') are added or removed; ones the Vice Principal set by hand are never touched,
    // and a teacher whose evaluation was already submitted is never removed.
    const me = await prisma.user.findUnique({ where: { id: session.id }, select: { className: true, level: true } });
    const cls = (me?.className ?? '').trim().toUpperCase(), lvl = normLevel(me?.level);
    const teachers = await prisma.user.findMany({ where: { role: 'TEACHER' }, select: { id: true, className: true, level: true } });
    const wanted = new Set(cls && lvl ? teachers.filter(t => (t.className ?? '').trim().toUpperCase() === cls && normLevel(t.level) === lvl).map(t => t.id) : []);
    const current = await prisma.studentAssignment.findMany({ where: { periodId: period.id, studentId: session.id }, include: { evaluations: { select: { id: true } } } });
    const stale = current.filter(a => a.assignedById === 'AUTO-CLASS' && !wanted.has(a.teacherId) && a.evaluations.length === 0).map(a => a.id);
    if (stale.length) await prisma.studentAssignment.deleteMany({ where: { id: { in: stale } } });
    const have = new Set(current.map(a => a.teacherId));
    const toAdd = [...wanted].filter(id => !have.has(id));
    if (toAdd.length) await prisma.studentAssignment.createMany({
      data: toAdd.map(teacherId => ({ periodId: period.id, studentId: session.id, teacherId, assignedById: 'AUTO-CLASS' })),
      skipDuplicates: true,
    });
    const st = await prisma.studentAssignment.findMany({ where: { periodId: period.id, studentId: session.id }, include: { teacher: { select: { id: true, name: true } } } });
    for (const a of st) (isDone('STUDENT', a.teacherId) ? out.STUDENT.submitted : out.STUDENT.pending).push({ teacherId: a.teacher.id, name: a.teacher.name, role: 'TEACHER' });
  }
  return NextResponse.json(out);
}
