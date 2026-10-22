import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { teachersForClass, type MemberLite } from '@/lib/sd/rules';
import { inScope, scopeOf } from '@/lib/levelScope';
import { fail, publishedMembers, requireRole } from '@/lib/sd/access';

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
  const members = await publishedMembers(periodId, scope);
  const classes = [...new Set(members.flatMap(m => [m.group.classOne, m.group.classTwo]))].sort();
  if (!className) return NextResponse.json({ classes });

  const seen = new Set<string>();
  const eligible = teachersForClass(className, members as unknown as MemberLite[]).filter(m => !seen.has(m.teacherId) && seen.add(m.teacherId)).map(m => {
    const full = members.find(x => x.id === m.id)!;
    return { teacherId: m.teacherId, name: full.teacher.name, subject: m.subject, group: full.group.name };
  });
  const students = (await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, name: true, className: true, level: true }, orderBy: { name: 'asc' } }))
    .filter(s => ci(s.className) === ci(className) && inScope(scope, s.level));
  const assigns = await prisma.studentAssignment.findMany({
    where: { periodId, studentId: { in: students.map(s => s.id) } },
    include: { evaluations: { select: { id: true } } },
  });
  return NextResponse.json({
    classes, eligible,
    students: students.map(s => {
      const mine = assigns.filter(a => a.studentId === s.id);
      return { ...s, assigned: mine.map(a => ({ assignmentId: a.id, teacherId: a.teacherId, submitted: a.evaluations.length > 0 })) };
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

  const students = await prisma.user.findMany({ where: { id: { in: studentIds }, role: 'STUDENT' }, select: { id: true, name: true, className: true, level: true } });
  if (students.length !== new Set(studentIds).size) return fail('Every selected user must be a student.');
  const scope = scopeOf(g.session);
  if (students.some(s => !inScope(scope, s.level))) return fail('You can only assign students of your own school.', 403);
  const members = (await publishedMembers(periodId, scope)) as unknown as MemberLite[];

  const wanted: { studentId: string; teacherId: string }[] = [];
  for (const s of students) {
    const ok = new Set(teachersForClass(s.className, members).map(m => m.teacherId));
    for (const t of teacherIds) {
      if (mode !== 'remove' && !ok.has(t)) return fail(`A selected teacher does not teach ${s.name}'s class (${s.className ?? 'no class'}) in a published group.`);
      wanted.push({ studentId: s.id, teacherId: t });
    }
  }

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
