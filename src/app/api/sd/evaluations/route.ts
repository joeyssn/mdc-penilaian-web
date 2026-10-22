import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';
import { averageOf, categoryOf, canPeerEvaluate, SUBJECT_LABEL, type MemberLite } from '@/lib/sd/rules';
import { scopeOf } from '@/lib/levelScope';
import { fail, groupScopeWhere, openPeriod, publishedMembers, requireRole, SD_VIEW_ROLES, GROUP_MANAGE_ROLES } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

const TYPES = ['PEER', 'SUPERVISOR', 'STUDENT'] as const;
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
  let groupId: string | null = null, supervisorAssignmentId: string | null = null, studentAssignmentId: string | null = null;
  let context: Record<string, unknown> = {};
  if ((type as EvalType) === 'PEER') {
    if (session.role !== 'TEACHER') return fail('Only teachers can submit peer evaluations.', 403);
    const all = await publishedMembers(period.id);
    const myGroupIds = [...new Set(all.filter(m => m.teacherId === session.id).map(m => m.groupId))];
    if (myGroupIds.length === 0) return fail('You are not in a published group for this period.', 403);
    const submitted = new Set((await prisma.sdEvaluation.findMany({ where: { type: 'PEER', periodId: period.id, evaluatorId: session.id }, select: { targetId: true } })).map(e => e.targetId));
    // A teacher may be in several groups: the evaluation is allowed if ANY of them makes the target eligible.
    let res: ReturnType<typeof canPeerEvaluate> = { ok: false, reason: 'That teacher is not in any of your groups.' };
    let members: typeof all = [];
    for (const gid of myGroupIds) {
      const gm = all.filter(m => m.groupId === gid);
      const r = canPeerEvaluate(session.id, targetId, gm as unknown as MemberLite[], submitted);
      if (r.ok) { res = r; members = gm; break; }
      if (r.reason.startsWith('You already')) { res = r; break; }
    }
    if (!res.ok) return fail(res.reason, res.reason.startsWith('You already') ? 409 : 403);
    const mine = members[0];
    groupId = mine.groupId;
    const me = members.filter(m => m.teacherId === session.id);
    context = {
      group: mine.group.name, targetClass: res.target.className, targetSubject: SUBJECT_LABEL[res.target.subject], category: res.target.category, isPartner: res.target.isPartner,
      evaluatorSubjects: me.map(m => `${SUBJECT_LABEL[m.subject]} ${m.className}`),
    };
  } else if (type === 'SUPERVISOR') {
    const a = await prisma.supervisorAssignment.findUnique({ where: { periodId_supervisorId_teacherId: { periodId: period.id, supervisorId: session.id, teacherId: targetId } } });
    if (!a || !a.active) return fail('You are not assigned as supervisor of this teacher.', 403);
    supervisorAssignmentId = a.id;
  } else {
    if (session.role !== 'STUDENT') return fail('Only students can submit student evaluations.', 403);
    const a = await prisma.studentAssignment.findUnique({ where: { periodId_studentId_teacherId: { periodId: period.id, studentId: session.id, teacherId: targetId } } });
    if (!a) return fail('This teacher was not assigned to you.', 403);
    studentAssignmentId = a.id;
  }

  // 2. Rubric + answers
  const rubric = await prisma.rubric.findUnique({
    where: { id: rubricId },
    include: { rubricsection: { include: { rubriccategory: { include: { rubricindicator: { select: { id: true } } } } } } },
  });
  if (!rubric || rubric.schoolLevel !== 'SD' || rubric.isSelfReflection) return fail('That rubric cannot be used for this evaluation.');
  const forStudents = (rubric.evaluators ?? '').split(',').map(s => s.trim().toLowerCase()).includes('student');
  if (forStudents !== (type === 'STUDENT')) return fail(type === 'STUDENT' ? 'Students must use the student rubric.' : 'The student rubric is only for student evaluations.');
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
        type, periodId: period.id, evaluatorId: session.id, targetId, groupId, supervisorAssignmentId, studentAssignmentId, rubricId,
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

// Progress and (when allowed) results per teacher, with the three sources kept apart.
export async function GET(req: Request) {
  const g = await requireRole([...new Set([...SD_VIEW_ROLES, ...GROUP_MANAGE_ROLES])]); if (g.error) return g.error;
  const periodId = new URL(req.url).searchParams.get('periodId') || (await openPeriod())?.id;
  if (!periodId) return NextResponse.json([]);
  const hide = !SCORE_VIEWER_ROLES.includes(g.session.role) && (await isScoresLockedFor(g.session));

  const [evals, sups, studs, members] = await Promise.all([
    prisma.sdEvaluation.findMany({ where: { periodId }, select: { type: true, targetId: true, average: true } }),
    prisma.supervisorAssignment.findMany({ where: { periodId, active: true }, select: { teacherId: true } }),
    prisma.studentAssignment.findMany({ where: { periodId }, select: { teacherId: true } }),
    prisma.groupMember.findMany({ where: { group: { periodId, status: 'PUBLISHED', ...groupScopeWhere(scopeOf(g.session)) } }, include: { teacher: { select: { id: true, name: true } }, group: { select: { name: true } } } }),
  ]);
  const ids = [...new Set([...members.map(m => m.teacherId)])];
  const rows = ids.map(id => {
    const ms = members.filter(m => m.teacherId === id);
    const part = (t: string, assigned?: number) => {
      const list = evals.filter(e => e.type === t && e.targetId === id);
      return { submitted: list.length, assigned, average: hide || !list.length ? null : Number(averageOf(list.map(e => e.average)).toFixed(2)) };
    };
    // Expected peer evaluations = other teachers of the same category in the group (a standing figure, not an assignment table).
    return {
      teacherId: id, name: ms[0].teacher.name, group: [...new Set(ms.map(m => m.group.name))].join(', '),
      subjects: ms.map(m => `${SUBJECT_LABEL[m.subject]} ${m.className}`), category: [...new Set(ms.map(m => categoryOf(m.subject)))].join(' + '),
      peer: part('PEER'), supervisor: part('SUPERVISOR', sups.filter(s => s.teacherId === id).length), student: part('STUDENT', studs.filter(s => s.teacherId === id).length),
    };
  });
  return NextResponse.json(rows.sort((a, b) => a.name.localeCompare(b.name)));
}
