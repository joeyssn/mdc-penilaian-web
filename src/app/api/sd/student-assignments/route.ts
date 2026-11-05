import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { inScope, normLevel, scopeOf } from '@/lib/levelScope';
import { fail, isSdUser, requireRole } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

const READ = ['VICE_PRINCIPAL_KESISWAAN', 'PRINCIPAL', 'ADMIN', 'DIRECTOR'];
const WRITE = ['VICE_PRINCIPAL_KESISWAAN'];
const ci = (s?: string | null) => (s ?? '').trim().toUpperCase();

// Students of one class, with the teachers each is assigned and the teachers that may be assigned.
export async function GET(req: Request) {
  const g = await requireRole(READ); if (g.error) return g.error;
  const url = new URL(req.url);
  const periodId = url.searchParams.get('periodId'), className = url.searchParams.get('className');
  if (!periodId) return fail('periodId is required.');
  const scope = scopeOf(g.session);
  const people = await prisma.user.findMany({ where: { role: { in: ['STUDENT', 'TEACHER'] } }, select: { id: true, name: true, role: true, className: true, level: true }, orderBy: { name: 'asc' } });
  const visible = people.filter(u => isSdUser(u) && inScope(scope, u.level) && String(u.level ?? '').toUpperCase() !== 'TK'); // TK has no student evaluation
  const allStudents = visible.filter(u => u.role === 'STUDENT');
  const classes = [...new Set(allStudents.map(s => s.className).filter(Boolean) as string[])].sort();
  if (!className) return NextResponse.json({ classes });

  const students = allStudents.filter(s => ci(s.className) === ci(className));
  const eligible = visible.filter(u => u.role === 'TEACHER').map(t => ({ teacherId: t.id, name: t.name, subject: t.className ? `class ${t.className}` : '', level: t.level, sameClass: ci(t.className) === ci(className) }));
  const assigns = await prisma.studentAssignment.findMany({
    where: { periodId, studentId: { in: students.map(s => s.id) } },
    include: { evaluations: { select: { id: true } } },
  });
  return NextResponse.json({
    classes, eligible,
    students: students.map(s => {
      const mine = assigns.filter(a => a.studentId === s.id);
      return { id: s.id, name: s.name, className: s.className, assigned: mine.map(a => ({ assignmentId: a.id, teacherId: a.teacherId, submitted: a.evaluations.length > 0 })) };
    }),
  });
}

// mode: add | remove | replace. Same teacher set for many students; individual exceptions are just another call.
export async function PUT(req: Request) {
  const g = await requireRole(WRITE); if (g.error) return g.error;
  const { periodId, studentIds, teacherIds, mode = 'add' } = await req.json();
  if (!periodId || !Array.isArray(studentIds) || !Array.isArray(teacherIds) || !['add', 'remove', 'replace'].includes(mode)) return fail('periodId, studentIds, teacherIds and a valid mode are required.');
  if (studentIds.length === 0) return fail('Select at least one student.');
  const period = await prisma.evalPeriod.findUnique({ where: { id: periodId } });
  if (!period) return fail('Period not found.', 404);
  if (period.status === 'CLOSED') return fail('This period is closed. Assignments are locked.', 409);

  const scope = scopeOf(g.session);
  const students = await prisma.user.findMany({ where: { id: { in: studentIds }, role: 'STUDENT' }, select: { id: true, name: true, level: true } });
  if (students.length !== new Set(studentIds).size) return fail('Every selected user must be a student.');
  if (students.some(s => !inScope(scope, s.level))) return fail('You can only assign students of your own school.', 403);
  const teachers = await prisma.user.findMany({ where: { id: { in: teacherIds }, role: 'TEACHER' }, select: { id: true, name: true, level: true } });
  if (mode !== 'remove') {
    if (teachers.length !== new Set(teacherIds).size) return fail('Every selected teacher must be a teacher account.');
    // a student evaluates teachers of their own school (TK students -> TK teachers, SD -> SD)
    const bad = students.flatMap(s => teachers.filter(t => normLevel(t.level) !== normLevel(s.level)).map(t => `${s.name} / ${t.name}`));
    if (bad.length) return fail(`Teacher and student must be in the same school: ${bad.slice(0, 3).join(', ')}.`);
  }

  const wanted = students.flatMap(s => teacherIds.map((t: string) => ({ studentId: s.id, teacherId: t })));
  const existing = await prisma.studentAssignment.findMany({ where: { periodId, studentId: { in: students.map(s => s.id) } }, include: { evaluations: { select: { id: true } } } });
  const key = (a: { studentId: string; teacherId: string }) => `${a.studentId}|${a.teacherId}`;
  const wantedKeys = new Set(wanted.map(key));
  const toDelete = mode === 'remove' ? existing.filter(a => wantedKeys.has(key(a))) : mode === 'replace' ? existing.filter(a => !wantedKeys.has(key(a))) : [];
  const locked = toDelete.filter(a => a.evaluations.length > 0);
  if (locked.length) return fail('Some of these assignments already have a submitted evaluation and cannot be removed.', 409);
  const have = new Set(existing.map(key));
  const toCreate = mode === 'remove' ? [] : wanted.filter(w => !have.has(key(w)));

  await prisma.$transaction([
    prisma.studentAssignment.deleteMany({ where: { id: { in: toDelete.map(a => a.id) } } }),
    prisma.studentAssignment.createMany({ data: toCreate.map(w => ({ ...w, periodId, assignedById: g.session.id })), skipDuplicates: true }),
  ]);
  await writeAudit(g.session, 'SD_STUDENT_ASSIGNMENTS', 'StudentAssignment', periodId, { mode, students: students.length, teachers: teacherIds.length, created: toCreate.length, removed: toDelete.length });
  return NextResponse.json({ created: toCreate.length, removed: toDelete.length });
}
