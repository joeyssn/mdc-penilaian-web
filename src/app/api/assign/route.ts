import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getSession } from '@/lib/session';
import { diffAssignments, EVALUATOR_ROLES, type EvaluatorRole } from '@/lib/sd/rules';
import { candidatesFor, evaluatorErrors, isTarget, MODE_LABEL, MODE_ROLES, MODES, modesFor, type Mode } from '@/lib/assign/rules';

export const dynamic = 'force-dynamic';

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const USER_SELECT = { id: true, name: true, role: true, level: true, division: true } as const;
const ROLES = ['DIRECTOR', 'PRINCIPAL', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'HEAD_MANAGEMENT', 'ADMIN', 'STAFF', 'TEACHER', 'KARYAWAN'] as const;

// GET (no mode)        -> the modes this user may use, open periods, and their own evaluator tasks
// GET ?mode&periodId   -> the targets of that mode with who evaluates each
// GET ?mode&targetId   -> who may be picked for that target, per role
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return err('Not authenticated', 401);
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') as Mode | null;
  const allowed = modesFor(session);

  const periods = await prisma.evalPeriod.findMany({ where: { status: { in: ['OPEN', 'DRAFT'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true } });

  if (!mode) {
    const open = periods.find(p => p.status === 'OPEN') ?? periods[0];
    const mine = open ? await prisma.teacherAssignment.findMany({
      where: { periodId: open.id, active: true, OR: [{ evaluatorId: session.id }, { teacherId: session.id }] },
      include: { teacher: { select: { id: true, name: true } }, evaluator: { select: { id: true, name: true } } },
    }) : [];
    return NextResponse.json({
      modes: allowed.map(m => ({ mode: m, label: MODE_LABEL[m], roles: MODE_ROLES[m] })),
      periods,
      toEvaluate: mine.filter(a => a.evaluatorId === session.id).map(a => ({ id: a.teacher.id, name: a.teacher.name, role: a.role })),
      evaluatedBy: mine.filter(a => a.teacherId === session.id).map(a => ({ id: a.evaluator.id, name: a.evaluator.name, role: a.role })),
    });
  }

  if (!MODES.includes(mode) || !allowed.includes(mode)) return err('You cannot use this assignment screen.', 403);
  const people = await prisma.user.findMany({ where: { role: { in: [...ROLES] } }, select: USER_SELECT, orderBy: { name: 'asc' } });
  const targets = people.filter(u => isTarget(mode, session, u));

  const targetId = url.searchParams.get('targetId');
  if (targetId) {
    const target = targets.find(t => t.id === targetId);
    if (!target) return err('That person is not one of your targets.', 403);
    const candidates: Record<string, typeof people> = {};
    for (const r of MODE_ROLES[mode]) candidates[r] = candidatesFor(mode, r, target, people);
    return NextResponse.json({ candidates });
  }

  const periodId = url.searchParams.get('periodId') || periods[0]?.id;
  if (!periodId) return NextResponse.json({ periodId: null, targets: [] });
  const rows = await prisma.teacherAssignment.findMany({
    where: { periodId, active: true, teacherId: { in: targets.map(t => t.id) } },
    include: { evaluator: { select: { id: true, name: true } }, evaluations: { select: { id: true } } },
  });
  return NextResponse.json({
    periodId,
    targets: targets.map(t => ({
      ...t,
      assigned: Object.fromEntries(MODE_ROLES[mode].map(r => [r, rows.filter(a => a.teacherId === t.id && a.role === r).map(a => ({ evaluatorId: a.evaluator.id, name: a.evaluator.name, submitted: a.evaluations.length > 0 }))])),
    })),
  });
}

// Replace the evaluators of one role for one target: { mode, periodId, targetId, role, evaluatorIds }
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return err('Not authenticated', 401);
  const { mode, periodId, targetId, role, evaluatorIds } = await req.json();
  if (!MODES.includes(mode) || !modesFor(session).includes(mode)) return err('You cannot use this assignment screen.', 403);
  if (!EVALUATOR_ROLES.includes(role) || !MODE_ROLES[mode as Mode].includes(role) || !Array.isArray(evaluatorIds)) return err('mode, periodId, targetId, role and evaluatorIds are required.');

  const period = periodId && (await prisma.evalPeriod.findUnique({ where: { id: periodId } }));
  if (!period) return err('Period not found.', 404);
  if (period.status === 'CLOSED') return err('This period is closed. Assignments are locked.', 409);

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: USER_SELECT });
  if (!target || !isTarget(mode, session, target)) return err('You cannot assign evaluators for this person.', 403);

  const ids = [...new Set<string>(evaluatorIds)];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: USER_SELECT });
  if (people.length !== ids.length) return err('One of the selected people does not exist.');
  for (const p of people) {
    const errs = evaluatorErrors(mode, role as EvaluatorRole, target, p);
    if (errs.length) return err(`${p.name}: ${errs.join(' ')}`);
  }

  const existing = await prisma.teacherAssignment.findMany({ where: { periodId, teacherId: targetId, role }, include: { evaluations: { select: { id: true } } } });
  const d = diffAssignments(existing.map(e => ({ evaluatorId: e.evaluatorId, active: e.active, hasEvaluations: e.evaluations.length > 0 })), ids);
  await prisma.$transaction([
    prisma.teacherAssignment.deleteMany({ where: { periodId, teacherId: targetId, role, evaluatorId: { in: d.toDelete } } }),
    prisma.teacherAssignment.updateMany({ where: { periodId, teacherId: targetId, role, evaluatorId: { in: d.toDeactivate } }, data: { active: false } }),
    prisma.teacherAssignment.updateMany({ where: { periodId, teacherId: targetId, role, evaluatorId: { in: d.toReactivate } }, data: { active: true, assignedById: session.id } }),
    prisma.teacherAssignment.createMany({ data: d.toCreate.map(evaluatorId => ({ periodId, teacherId: targetId, evaluatorId, role, assignedById: session.id })), skipDuplicates: true }),
  ]);
  await writeAudit(session, 'ASSIGN_EVALUATORS_SET', 'TeacherAssignment', targetId, { mode, periodId, role, evaluators: ids });
  return NextResponse.json({ ok: true });
}
