import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getSession } from '@/lib/session';
import { diffAssignments, EVALUATOR_ROLES, type EvaluatorRole } from '@/lib/sd/rules';
import { candidatesFor, DIVISIONS, evaluatorErrors, headCandidates, isTarget, MODE_LABEL, MODE_ROLES, MODES, modesFor, normDivision, type Heads, type Mode } from '@/lib/assign/rules';

export const dynamic = 'force-dynamic';

// Always answer with JSON, even when the database is out of date (schema not pushed yet), so the page can show the reason.
const fail500 = (e: any) => {
  console.error('ASSIGN API ERROR:', e);
  const m = String(e?.message || e);
  const hint = /division|HEAD_MANAGEMENT|Unknown (argument|field)|does not exist|Invalid value for argument/i.test(m) ? ' The database is not up to date: run `npx prisma db push` and `npx prisma generate`, then restart the server.' : '';
  return NextResponse.json({ error: `Could not load assignments.${hint}` }, { status: 500 });
};
const HEAD_KEY = (d: string) => `divisionHead:${d}`;
const loadHeads = async (): Promise<Heads> => {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: DIVISIONS.map(HEAD_KEY) } } });
  return Object.fromEntries(rows.filter(r => r.value).map(r => [r.key.split(':')[1], r.value as string]));
};
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const USER_SELECT = { id: true, name: true, role: true, level: true, division: true } as const;
const ROLES = ['DIRECTOR', 'PRINCIPAL', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'HEAD_MANAGEMENT', 'ADMIN', 'STAFF', 'TEACHER', 'KARYAWAN'] as const;

// GET (no mode)        -> the modes this user may use, open periods, and their own evaluator tasks
// GET ?mode&periodId   -> the targets of that mode with who evaluates each
// GET ?mode&targetId   -> who may be picked for that target, per role
export async function GET(req: Request) {
  try { return await handleGet(req); } catch (e: any) { return fail500(e); }
}

async function handleGet(req: Request) {
  const session = await getSession();
  if (!session) return err('Not authenticated', 401);
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') as Mode | null;
  const allowed = modesFor(session);

  const periods = await prisma.evalPeriod.findMany({ where: { status: { in: ['OPEN', 'DRAFT'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, status: true } });

  if (!mode) {
    const heads = allowed.includes('HEAD_WORKERS') ? await loadHeads() : {};
    const everyone = allowed.includes('HEAD_WORKERS') ? await prisma.user.findMany({ where: { role: { in: ['HEAD_MANAGEMENT', 'ADMIN', 'STAFF'] } }, select: USER_SELECT, orderBy: { name: 'asc' } }) : [];
    const open = periods.find(p => p.status === 'OPEN') ?? periods[0];
    const mine = open ? await prisma.teacherAssignment.findMany({
      where: { periodId: open.id, active: true, OR: [{ evaluatorId: session.id }, { teacherId: session.id }] },
      include: { teacher: { select: { id: true, name: true } }, evaluator: { select: { id: true, name: true } } },
    }) : [];
    return NextResponse.json({
      heads,
      headCandidates: Object.fromEntries(DIVISIONS.map(d => [d, headCandidates(d, everyone)])),
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
    const heads = await loadHeads();
    for (const r of MODE_ROLES[mode]) candidates[r] = candidatesFor(mode, r, target, people, heads);
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
  try { return await handlePut(req); } catch (e: any) { return fail500(e); }
}

async function handlePut(req: Request) {
  const session = await getSession();
  if (!session) return err('Not authenticated', 401);
  const body = await req.json();
  if (body.action === 'setHead') return setHead(session, body);
  const { mode, periodId, targetId, role, evaluatorIds } = body;
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
    const errs = evaluatorErrors(mode, role as EvaluatorRole, target, p, mode === 'HEAD_WORKERS' ? await loadHeads() : {});
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


// The Director chooses the head of a division: { action: 'setHead', division, headId (or null to clear), periodId? }.
// Workers of that division who have no head evaluator yet in the chosen period get this head added; nobody's existing assignment is removed.
async function setHead(session: { id: string; name: string; role: string; level?: string | null }, body: any) {
  if (!modesFor(session).includes('HEAD_WORKERS')) return err('Only the Director can choose division heads.', 403);
  const division = normDivision(body.division);
  if (!division) return err('Choose a division: IT, HRD, ADMIN or PR.');
  const key = HEAD_KEY(division);
  if (!body.headId) {
    await prisma.appSetting.deleteMany({ where: { key } });
    await writeAudit(session as any, 'DIVISION_HEAD_CLEARED', 'AppSetting', key, { division });
    return NextResponse.json({ ok: true, added: 0 });
  }
  const head = await prisma.user.findUnique({ where: { id: body.headId }, select: USER_SELECT });
  if (!head || !headCandidates(division, [head]).length) return err('That account cannot be the head of this division (it must be Head Management, admin or staff of the same division).');
  await prisma.appSetting.upsert({ where: { key }, update: { value: head.id }, create: { key, value: head.id } });

  let added = 0;
  const period = body.periodId ? await prisma.evalPeriod.findUnique({ where: { id: body.periodId } }) : null;
  if (period && period.status !== 'CLOSED') {
    const workers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'STAFF'] } }, select: USER_SELECT });
    const mine = workers.filter(w => normDivision(w.division) === division && w.id !== head.id);
    const have = await prisma.teacherAssignment.findMany({ where: { periodId: period.id, role: 'SUPERVISOR', active: true, teacherId: { in: mine.map(w => w.id) } }, select: { teacherId: true } });
    const done = new Set(have.map(h => h.teacherId));
    const todo = mine.filter(w => !done.has(w.id));
    if (todo.length) {
      const r = await prisma.teacherAssignment.createMany({ data: todo.map(w => ({ periodId: period.id, teacherId: w.id, evaluatorId: head.id, role: 'SUPERVISOR' as const, assignedById: session.id })), skipDuplicates: true });
      added = r.count;
    }
  }
  await writeAudit(session as any, 'DIVISION_HEAD_SET', 'AppSetting', key, { division, headId: head.id, added });
  return NextResponse.json({ ok: true, added });
}
