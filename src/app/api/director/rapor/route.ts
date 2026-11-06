import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';
import { inScope, scopeOf } from '@/lib/levelScope';
import { toNumericScore } from '@/lib/scoreScale';
import { isSdGroupLevel } from '@/lib/weights';

export const dynamic = 'force-dynamic';

const VIEWERS = ['DIRECTOR', 'ADMIN', 'HRD', 'PRINCIPAL'];
const PEER_ROLES = ['TEACHER', 'STAFF', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'PRINCIPAL', 'HRD', 'KARYAWAN'];

// Data behind one person's report card: who they are, the school head who signs, and the average
// of every rubric question grouped under its competency, kept separate per evaluator type.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!VIEWERS.includes(session.role)) return NextResponse.json({ error: 'You do not have permission to do this.' }, { status: 403 });
  if (!SCORE_VIEWER_ROLES.includes(session.role) && (await isScoresLockedFor(session))) return NextResponse.json({ error: 'Scores are locked.' }, { status: 403 });

  const userId = new URL(req.url).searchParams.get('userId') || '';
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, level: true } });
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (!inScope(scopeOf(session), user.level)) return NextResponse.json({ error: 'This person is in another school.' }, { status: 403 });

  const period = (await prisma.evalPeriod.findFirst({ where: { status: 'OPEN' } })) ?? (await prisma.evalPeriod.findFirst({ orderBy: { createdAt: 'desc' } }));
  const principal = await prisma.user.findFirst({ where: { role: 'PRINCIPAL', ...(user.level ? { level: user.level } : {}) }, select: { name: true } });

  // value lists per indicator and evaluator type
  const acc = new Map<string, Record<string, number[]>>();
  const put = (indicatorId: string, type: string, v: number) => {
    if (!v) return;
    const m = acc.get(indicatorId) ?? {}; (m[type] ??= []).push(v); acc.set(indicatorId, m);
  };

  const sd = isSdGroupLevel(user.level) && user.role === 'TEACHER';
  const evals = period ? await prisma.sdEvaluation.findMany({ where: { periodId: period.id, targetId: user.id }, select: { type: true, answers: true } }) : [];
  for (const e of evals) {
    if (e.type === 'STUDENT') continue; // the student part has its own line in the report
    for (const a of (e.answers as any[]) ?? []) put(String(a.indicatorId), e.type, Number(a.value));
  }
  const scores = await prisma.score.findMany({ where: { targetId: user.id }, include: { user_score_graderIdTouser: { select: { role: true } } } });
  for (const s of scores as any[]) {
    const gr = String(s.user_score_graderIdTouser?.role || '').toUpperCase();
    if (s.graderId === user.id) put(s.indicatorId, 'SELF', toNumericScore(s.value));
    else if (!sd && PEER_ROLES.includes(gr)) put(s.indicatorId, 'PEER', toNumericScore(s.value));
  }

  const ids = [...acc.keys()];
  const inds = await prisma.rubricindicator.findMany({
    where: { id: { in: ids } },
    select: { id: true, text: true, order: true, rubriccategory: { select: { title: true, order: true, rubricsection: { select: { title: true, order: true } } } } },
  });
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  // the same question can sit in several rubrics (peer / supervisor / self): merge them by their text
  const merged = new Map<string, { group: string; gOrder: number; order: number; text: string; byType: Record<string, number[]> }>();
  for (const i of inds) {
    const group = i.rubriccategory?.title || i.rubriccategory?.rubricsection?.title || 'Penilaian';
    const key = group + '|' + i.text.trim().toLowerCase();
    const m = merged.get(key) ?? { group, gOrder: (i.rubriccategory?.rubricsection?.order ?? 0) * 100 + (i.rubriccategory?.order ?? 0), order: i.order, text: i.text, byType: {} };
    for (const [t, arr] of Object.entries(acc.get(i.id) ?? {})) (m.byType[t] ??= []).push(...arr);
    merged.set(key, m);
  }
  const items = [...merged.values()].sort((a, b) => a.gOrder - b.gOrder || a.order - b.order)
    .map(m => ({ group: m.group, text: m.text, byType: Object.fromEntries(Object.entries(m.byType).map(([t, a]) => [t, mean(a)])) }));

  return NextResponse.json({ user, period: period?.name ?? '', principal: principal?.name ?? '', items });
}
