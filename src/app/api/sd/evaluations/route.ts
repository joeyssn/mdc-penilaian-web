import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';
import { averageOf, canSubmit } from '@/lib/sd/rules';
import { isRubricAllowed } from '@/lib/sd/rubricRules';
import { inScope, scopeOf } from '@/lib/levelScope';
import { isSdUser } from '@/lib/sd/access';
import { fail, openPeriod, requireRole, SD_VIEW_ROLES, GROUP_MANAGE_ROLES } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

const TYPES = ['PEER', 'SUPERVISOR', 'KOORDINATOR', 'STUDENT'] as const;
type EvalType = (typeof TYPES)[number];

// Submit one evaluation. The evaluator always comes from the session; the server re-checks eligibility
// for every request, whatever the browser showed.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail('Not authenticated', 401);
  const { type, targetId, rubricId, scores } = await req.json();
  if (!TYPES.includes(type)) return fail('type must be PEER, SUPERVISOR or STUDENT.');
  if (!targetId || !rubricId || !Array.isArray(scores)) return fail('targetId, rubricId and scores are required.');

  const period = await openPeriod();
  if (!period) return fail('There is no open evaluation period.', 409);

  // 1. Is this evaluator allowed to score this target, in this workflow?
  let assignmentId: string | null = null, studentAssignmentId: string | null = null;
  let context: Record<string, unknown> = {};
  if (session.id === targetId) return fail('You cannot evaluate yourself.', 403);
  if (type === 'STUDENT') {
    if (session.role !== 'STUDENT') return fail('Only students can submit student evaluations.', 403);
    const a = await prisma.studentAssignment.findUnique({ where: { periodId_studentId_teacherId: { periodId: period.id, studentId: session.id, teacherId: targetId } } });
    if (!a) return fail('This teacher was not assigned to you.', 403);
    studentAssignmentId = a.id;
  } else {
    const a = await prisma.teacherAssignment.findUnique({ where: { periodId_teacherId_evaluatorId_role: { periodId: period.id, teacherId: targetId, evaluatorId: session.id, role: type } } });
    if (!canSubmit(type, a)) return fail(`You are not assigned as ${String(type).toLowerCase()} of this teacher.`, 403);
    assignmentId = a!.id;
    context = { role: type, evaluatorRole: session.role };
  }

  // 2. Rubric + answers
  const rubric = await prisma.rubric.findUnique({
    where: { id: rubricId },
    include: { rubricsection: { include: { rubriccategory: { include: { rubricindicator: { select: { id: true } } } } } } },
  });
  if (!rubric || rubric.schoolLevel !== 'SD' || rubric.isSelfReflection) return fail('That rubric cannot be used for this evaluation.');
  const baseRubrics = await prisma.rubric.findMany({ where: { schoolLevel: 'SD', isSelfReflection: false }, select: { id: true, evaluators: true } });
  // Use the evaluator's own school assignment (TK or SD) when one was saved, same as the page shows.
  const lvl = String(session.level || '').toUpperCase();
  const overrides = lvl === 'TK' || lvl === 'SD'
    ? await prisma.rubricLevelAssignment.findMany({ where: { level: lvl, rubricId: { in: baseRubrics.map(r => r.id) } }, select: { rubricId: true, evaluators: true } })
    : [];
  const ov = new Map(overrides.map(o => [o.rubricId, o.evaluators]));
  const sdRubrics = baseRubrics.map(r => (ov.has(r.id) ? { ...r, evaluators: ov.get(r.id) ?? null } : r));
  if (!isRubricAllowed(type, rubricId, sdRubrics)) return fail(`This rubric is not the one set for ${String(type).toLowerCase()} evaluations.`);
  const indicatorIds = new Set(rubric.rubricsection.flatMap(s => s.rubriccategory.flatMap(c => c.rubricindicator.map(i => i.id))));
  const answers = new Map<string, number>();
  for (const s of scores) {
    const v = Number(s?.value);
    if (!indicatorIds.has(s?.indicatorId) || !Number.isInteger(v) || v < 1 || v > 4) return fail('Every score must be a whole number from 1 to 4 for an indicator of this rubric.');
    answers.set(s.indicatorId, v);
  }
  if (answers.size !== indicatorIds.size) return fail('Please answer every question.');

  // 3. Save. The unique key (type, period, evaluator, target) blocks duplicates at database level.
  try {
    const ev = await prisma.sdEvaluation.create({
      data: {
        type, periodId: period.id, evaluatorId: session.id, targetId, assignmentId, studentAssignmentId, rubricId,
        answers: [...answers].map(([indicatorId, value]) => ({ indicatorId, value })), average: averageOf([...answers.values()]), context: context as any,
      },
    });
    return NextResponse.json({ id: ev.id, type: ev.type });
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('You already submitted this evaluation.', 409);
    console.error('SD EVALUATION ERROR', e);
    return fail('Could not save the evaluation.', 500);
  }
}

// Progress and (when allowed) results per teacher, with the four sources kept apart.
export async function GET(req: Request) {
  const g = await requireRole([...new Set([...SD_VIEW_ROLES, ...GROUP_MANAGE_ROLES])]); if (g.error) return g.error;
  const periodId = new URL(req.url).searchParams.get('periodId') || (await openPeriod())?.id;
  if (!periodId) return NextResponse.json([]);
  const hide = !SCORE_VIEWER_ROLES.includes(g.session.role) && (await isScoresLockedFor(g.session));
  const scope = scopeOf(g.session);

  const [teachers, evals, assigns, studs] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TEACHER' }, select: { id: true, name: true, level: true } }),
    prisma.sdEvaluation.findMany({ where: { periodId }, select: { type: true, targetId: true, average: true } }),
    prisma.teacherAssignment.findMany({ where: { periodId, active: true }, select: { teacherId: true, role: true } }),
    prisma.studentAssignment.findMany({ where: { periodId }, select: { teacherId: true } }),
  ]);
  const rows = teachers.filter(t => isSdUser(t) && inScope(scope, t.level)).map(t => {
    const part = (type: string, assigned: number) => {
      const list = evals.filter(e => e.type === type && e.targetId === t.id);
      return { submitted: list.length, assigned, average: hide || !list.length ? null : Number(averageOf(list.map(e => e.average)).toFixed(2)) };
    };
    const n = (role: string) => assigns.filter(a => a.teacherId === t.id && a.role === role).length;
    return { teacherId: t.id, name: t.name, supervisor: part('SUPERVISOR', n('SUPERVISOR')), peer: part('PEER', n('PEER')), koordinator: part('KOORDINATOR', n('KOORDINATOR')), student: part('STUDENT', studs.filter(s => s.teacherId === t.id).length) };
  });
  return NextResponse.json(rows.sort((a, b) => a.name.localeCompare(b.name)));
}
