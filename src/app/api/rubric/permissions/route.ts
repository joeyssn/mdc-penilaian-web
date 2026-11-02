import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VP_RUBRIC_KEY } from '@/lib/vpRubric';
import { getSession, RUBRIC_EDITOR_ROLES } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { normLevel, LEVELS } from '@/lib/levelScopeCore';

export const dynamic = 'force-dynamic';

// GET -> { schools: { TK: bool, SD: bool, SMP: bool, SMA: bool }, mine: bool } (mine = may the logged-in person assign rubrics)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const rows = await prisma.appSetting.findMany({ where: { key: { in: LEVELS.map(l => VP_RUBRIC_KEY(l)) } } }).catch(() => []);
  const schools = Object.fromEntries(LEVELS.map(l => [l, rows.find(r => r.key === VP_RUBRIC_KEY(l))?.value === 'true']));
  const isVp = session.role.startsWith('VICE_PRINCIPAL');
  const lvl = normLevel(session.level);
  return NextResponse.json({ schools, mine: !isVp || (!!lvl && !!schools[lvl]) });
}

// PUT { level, allowed } -> admin or director only
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!RUBRIC_EDITOR_ROLES.includes(session.role)) return NextResponse.json({ error: 'Only the admin can change this.' }, { status: 403 });
  const { level, allowed } = await req.json();
  const lvl = normLevel(level);
  if (!lvl) return NextResponse.json({ error: 'Choose a school: TK, SD, SMP or SMA.' }, { status: 400 });
  const key = VP_RUBRIC_KEY(lvl); const value = String(!!allowed);
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  await writeAudit(session, 'VP_RUBRIC_PERMISSION', 'AppSetting', key, { level: lvl, allowed: !!allowed });
  return NextResponse.json({ ok: true, level: lvl, allowed: !!allowed });
}
