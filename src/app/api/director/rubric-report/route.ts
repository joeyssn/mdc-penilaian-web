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
    id: e.id, type: e.type, period: e.period?.name ?? '', date: e.submittedAt,
    rubric: (e.rubricId && title.get(e.rubricId)) || 'Rubric',
    average: e.average,
    evaluator: { name: e.evaluator.name, role: e.evaluator.role, level: e.evaluator.level },
    target: { name: e.target.name, role: e.target.role, level: e.target.level },
    answers: ((e.answers as any[]) ?? []).map(a => ({ text: text.get(String(a.indicatorId)) ?? 'Question', value: a.value })),
  }));

  const observations = (await prisma.observation.findMany({ orderBy: { createdAt: 'desc' } })).map(o => ({
    id: o.id, date: o.date, kelas: o.kelas, subject: o.subject, target: o.targetName, observer: o.observerName,
    finalScore: o.finalScore, approved: o.isApproved, notesPositive: o.notesPositive, notesImprovement: o.notesImprovement,
  }));

  return NextResponse.json({ evaluations, observations });
}
