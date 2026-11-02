import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { averageOf, canSubmit } from '@/lib/sd/rules';
import { isRubricAllowed } from '@/lib/sd/rubricRules';
import { isSdGroupLevel } from '@/lib/weights';
import { openPeriod } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

const TYPES = ['PEER', 'SUPERVISOR', 'KOORDINATOR'] as const;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Submit one evaluation for someone the logged-in user was assigned to evaluate (vice principals, division workers, karyawan, SMP / SMA teachers).
// SD / TK teachers keep their own SD flow and SD rubrics. The evaluator always comes from the session and every rule is re-checked here.
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail('Not authenticated', 401);
    const { type, targetId, rubricId, scores } = await req.json();
    if (!TYPES.includes(type)) return fail('type must be PEER, SUPERVISOR or KOORDINATOR.');
    if (!targetId || !rubricId || !Array.isArray(scores)) return fail('targetId, rubricId and scores are required.');
    if (session.id === targetId) return fail('You cannot evaluate yourself.', 403);
    const period = await openPeriod();
    if (!period) return fail('There is no open evaluation period.', 409);

    const a = await prisma.teacherAssignment.findUnique({ where: { periodId_teacherId_evaluatorId_role: { periodId: period.id, teacherId: targetId, evaluatorId: session.id, role: type } } });
    if (!canSubmit(type, a)) return fail(`You are not assigned as ${type.toLowerCase()} of this person.`, 403);

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, level: true } });
    if (!target) return fail('Person not found.', 404);
    // SD / TK teachers are evaluated with SD rubrics in the SD screens; everyone else here uses the other rubrics.
    if (target.role === 'TEACHER' && isSdGroupLevel(target.level)) return fail('SD / TK teachers are evaluated in the SD screens (My Evaluations).', 409);

    const rubric = await prisma.rubric.findUnique({
      where: { id: rubricId },
      include: { rubricsection: { include: { rubriccategory: { include: { rubricindicator: { select: { id: true } } } } } } },
    });
    if (!rubric || rubric.schoolLevel === 'SD' || rubric.isSelfReflection) return fail('That rubric cannot be used for this evaluation.');
    const candidates = await prisma.rubric.findMany({ where: { schoolLevel: { not: 'SD' }, isSelfReflection: false }, select: { id: true, evaluators: true, evaluatees: true } });
    if (!isRubricAllowed(type, rubricId, candidates, { evaluatorRole: session.role, targetRole: target.role })) return fail(`This rubric is not the one set for ${type.toLowerCase()} evaluations.`);

    const indicatorIds = new Set(rubric.rubricsection.flatMap(s => s.rubriccategory.flatMap(c => c.rubricindicator.map(i => i.id))));
    const answers = new Map<string, number>();
    for (const s of scores) {
      const v = Number(s?.value);
      if (!indicatorIds.has(s?.indicatorId) || !Number.isInteger(v) || v < 1 || v > 4) return fail('Every score must be a whole number from 1 to 4 for an indicator of this rubric.');
      answers.set(s.indicatorId, v);
    }
    if (answers.size !== indicatorIds.size) return fail('Please answer every question.');

    const ev = await prisma.sdEvaluation.create({
      data: {
        type, periodId: period.id, evaluatorId: session.id, targetId, assignmentId: a!.id, rubricId,
        answers: [...answers].map(([indicatorId, value]) => ({ indicatorId, value })), average: averageOf([...answers.values()]),
        context: { role: type, evaluatorRole: session.role, general: true } as any,
      },
    });
    return NextResponse.json({ id: ev.id, type: ev.type });
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('You already submitted this evaluation.', 409);
    console.error('ASSIGN EVALUATION ERROR', e);
    return fail('Could not save the evaluation.', 500);
  }
}
