import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inScope, scopeOf } from '@/lib/levelScope';
import { writeAudit } from '@/lib/audit';
import { normLevel } from '@/lib/levelScope';
import { fail, requirePermission, requireRole, SD_VIEW_ROLES, GROUP_MANAGE_ROLES, isSdUser } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

// Who can be picked: SD / TK teachers (for every role) and students by class. Teachers only, no staff.
// `others` = teacher accounts that have no school yet, which the principal can add from the database.
export async function GET() {
  const g = await requireRole([...new Set([...SD_VIEW_ROLES, ...GROUP_MANAGE_ROLES])]); if (g.error) return g.error;
  const users = await prisma.user.findMany({
    where: { role: { in: ['TEACHER', 'STUDENT'] } },
    select: { id: true, name: true, role: true, level: true, className: true },
    orderBy: { name: 'asc' },
  });
  const scope = scopeOf(g.session);
  const sd = users.filter(u => isSdUser(u) && inScope(scope, u.level));
  const teachers = sd.filter(u => u.role === 'TEACHER');
  return NextResponse.json({
    teachers,
    leaders: teachers,
    students: sd.filter(u => u.role === 'STUDENT'),
    others: users.filter(u => u.role === 'TEACHER' && !normLevel(u.level)),
  });
}

// Add a teacher that exists in the database but has no school yet: they become a TK / SD teacher.
// Teachers of SMP / SMA are never touched.
export async function POST(req: Request) {
  const g = await requirePermission('supervisors'); if (g.error) return g.error;
  const { userId } = await req.json();
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== 'TEACHER') return fail('Only teacher accounts can be added.');
  if (normLevel(u.level)) return fail(`${u.name} already belongs to ${u.level}.`, 409);
  const level = scopeOf(g.session) ?? 'SD';
  await prisma.user.update({ where: { id: u.id }, data: { level } });
  await writeAudit(g.session, 'SD_TEACHER_ADDED', 'user', u.id, { name: u.name, level });
  return NextResponse.json({ ok: true, level });
}
