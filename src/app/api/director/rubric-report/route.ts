import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

// Everything every user has scored with a rubric (SD/TK/SMP/SMA evaluations + class observations),
// one flat list the Director's report page groups and prints. Scores are shown 1-4.
export async function GET() {
  const g = await requireRole(['DIRECTOR', 'ADMIN']);
  if (g.error) return g.error;

  const evals = await prisma.sdEvaluation.findMany({
    orderBy: { submittedAt: 'desc' },
    include: {
      period: { select: { name: true } },
      evaluator: { select: { name: true, role: true, level: true } },
      target: { select: { name: true, role: true, level: true } },
    },
  });
  const rubricIds = [...new Set(evals.map(e => e.rubricId).filter(Boolean))] as string[];
  const rubrics = await prisma.rubric.findMany({ where: { id: { in: rubricIds } }, select: { id: true, title: true } });
  const title = new Map(rubrics.map(r => [r.id, r.title]));

  const indIds = new Set<string>();
  for (const e of evals) for (const a of (e.answers as any[]) ?? []) indIds.add(String(a.indicatorId));
  const inds = await prisma.rubricindicator.findMany({ where: { id: { in: [...indIds] } }, select: { id: true, text: true } });
  const text = new Map(inds.map(i => [i.id, i.text]));

  const evaluations = evals.map(e => ({
    id: e.id, targetId: e.targetId, type: e.type, period: e.period?.name ?? '', date: e.submittedAt,
    rubric: (e.rubricId && title.get(e.rubricId)) || 'Rubric',
    average: e.average,
    evaluator: { name: e.evaluator.name, role: e.evaluator.role, level: e.evaluator.level },
    target: { name: e.target.name, role: e.target.role, level: e.target.level },
    answers: ((e.answers as any[]) ?? []).map(a => ({ text: text.get(String(a.indicatorId)) ?? 'Question', value: a.value })),
  }));

  // Staff / management rubrics (IT, PR, ACC, HRD, Karyawan, Admin...) and older scoring live in the score table.
  const LETTER: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  const scoreRows = await prisma.score.findMany({
    include: { user_score_graderIdTouser: { select: { name: true, role: true, level: true } }, user_score_targetIdTouser: { select: { name: true, role: true, level: true } }, rubricindicator: { select: { text: true, rubriccategory: { select: { rubricsection: { select: { rubric: { select: { title: true } } } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const legacy = new Map<string, any>();
  for (const r of scoreRows as any[]) {
    const k = r.graderId + '|' + r.targetId + '|' + (r.rubricindicator?.rubriccategory?.rubricsection?.rubric?.title ?? '');
    if (!legacy.has(k)) legacy.set(k, {
      id: 'score-' + r.id, targetId: r.targetId, type: r.graderId === r.targetId ? 'SELF' : 'STAFF', period: '', date: r.createdAt,
      rubric: r.rubricindicator?.rubriccategory?.rubricsection?.rubric?.title ?? 'Rubric', average: 0,
      evaluator: r.user_score_graderIdTouser, target: r.user_score_targetIdTouser, answers: [],
    });
    legacy.get(k).answers.push({ text: r.rubricindicator?.text ?? 'Question', value: LETTER[r.value] ?? 0 });
  }
  for (const e of legacy.values()) { e.average = e.answers.reduce((s: number, a: any) => s + a.value, 0) / (e.answers.length || 1); evaluations.push(e); }

  const obsRows = await prisma.observation.findMany({ orderBy: { createdAt: 'desc' } });
  const lv = new Map((await prisma.user.findMany({ where: { id: { in: obsRows.map(o => o.targetId) } }, select: { id: true, level: true } })).map(u => [u.id, u.level]));
  const observations = obsRows.map(o => ({
    level: lv.get(o.targetId) ?? null,
    id: o.id, date: o.date, kelas: o.kelas, subject: o.subject, target: o.targetName, observer: o.observerName,
    finalScore: o.finalScore, approved: o.isApproved, notesPositive: o.notesPositive, notesImprovement: o.notesImprovement,
  }));

  return NextResponse.json({ evaluations, observations });
}
