import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { inScope, scopeOf } from '@/lib/levelScope';
import { diffAssignments, EVALUATOR_ROLES, validateAssignment, type EvaluatorRole } from '@/lib/sd/rules';
import { fail, GROUP_MANAGE_ROLES, isSdUser, openPeriod, requirePermission, requireRole, SD_VIEW_ROLES } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

// Everything assigned in a period: for each teacher, who supervises, who is a peer, who is the koordinator.
export async function GET(req: Request) {
  const g = await requireRole([...new Set([...GROUP_MANAGE_ROLES, ...SD_VIEW_ROLES])]); if (g.error) return g.error;
  const periodId = new URL(req.url).searchParams.get('periodId') || (await openPeriod())?.id;
  if (!periodId) return NextResponse.json({ teachers: [] });
  const scope = scopeOf(g.session);
  const [teachers, rows, done] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TEACHER' }, select: { id: true, name: true, level: true, className: true }, orderBy: { name: 'asc' } }),
    prisma.teacherAssignment.findMany({ where: { periodId, active: true }, include: { evaluator: { select: { id: true, name: true } }, evaluations: { select: { id: true } } } }),
    prisma.sdEvaluation.groupBy({ by: ['targetId', 'type'], where: { periodId }, _count: { _all: true } }),
  ]);
  const out = teachers.filter(t => isSdUser(t) && inScope(scope, t.level)).map(t => {
    const mine = rows.filter(r => r.teacherId === t.id);
    const by = (role: EvaluatorRole) => mine.filter(r => r.role === role).map(r => ({ evaluatorId: r.evaluator.id, name: r.evaluator.name, submitted: r.evaluations.length > 0 }));
    return { ...t, SUPERVISOR: by('SUPERVISOR'), PEER: by('PEER'), KOORDINATOR: by('KOORDINATOR'),
      studentSubmitted: done.find(d => d.targetId === t.id && d.type === 'STUDENT')?._count._all ?? 0 };
  });
  return NextResponse.json({ periodId, teachers: out });
}

// Replace the evaluators of one role for one teacher: { periodId, teacherId, role, evaluatorIds }.
export async function PUT(req: Request) {
  const g = await requirePermission('supervisors'); if (g.error) return g.error;
  const { periodId, teacherId, role, evaluatorIds } = await req.json();
  if (!EVALUATOR_ROLES.includes(role) || !Array.isArray(evaluatorIds)) return fail('periodId, teacherId, role and evaluatorIds are required.');
  const period = periodId && (await prisma.evalPeriod.findUnique({ where: { id: periodId } }));
  if (!period) return fail('Period not found.', 404);
  if (period.status === 'CLOSED') return fail('This period is closed. Assignments are locked.', 409);

  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacher || teacher.role !== 'TEACHER' || !isSdUser(teacher)) return fail('The target must be an SD / TK teacher.');
  const scope = scopeOf(g.session);
  if (!inScope(scope, teacher.level)) return fail('You can only assign within your own school.', 403);

  const ids = [...new Set<string>(evaluatorIds)];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true, level: true } });
  if (people.length !== ids.length) return fail('One of the selected people does not exist.');
  for (const p of people) {
    const errs = validateAssignment(teacherId, p, role);
    if (errs.length) return fail(`${p.name}: ${errs.join(' ')}`);
    if (!isSdUser(p) || !inScope(scope, p.level)) return fail(`${p.name} is not an SD / TK account.`, 403);
  }

  const existing = await prisma.teacherAssignment.findMany({ where: { periodId, teacherId, role }, include: { evaluations: { select: { id: true } } } });
  const d = diffAssignments(existing.map(e => ({ evaluatorId: e.evaluatorId, active: e.active, hasEvaluations: e.evaluations.length > 0 })), ids);
  await prisma.$transaction([
    prisma.teacherAssignment.deleteMany({ where: { periodId, teacherId, role, evaluatorId: { in: d.toDelete } } }),
    prisma.teacherAssignment.updateMany({ where: { periodId, teacherId, role, evaluatorId: { in: d.toDeactivate } }, data: { active: false } }),
    prisma.teacherAssignment.updateMany({ where: { periodId, teacherId, role, evaluatorId: { in: d.toReactivate } }, data: { active: true, assignedById: g.session.id } }),
    prisma.teacherAssignment.createMany({ data: d.toCreate.map(evaluatorId => ({ periodId, teacherId, evaluatorId, role, assignedById: g.session.id })), skipDuplicates: true }),
  ]);
  await writeAudit(g.session, 'SD_ASSIGNMENT_SET', 'TeacherAssignment', teacherId, {
    periodId, role, evaluators: ids, added: d.toCreate.length + d.toReactivate.length, removed: d.toDelete.length + d.toDeactivate.length,
  });
  return NextResponse.json({ ok: true, added: d.toCreate.length + d.toReactivate.length, removed: d.toDelete.length + d.toDeactivate.length });
}
