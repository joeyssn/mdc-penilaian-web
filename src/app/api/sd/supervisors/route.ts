import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { inScope, scopeOf } from '@/lib/levelScope';
import { fail, isSdUser, openPeriod, requirePermission, requireRole, SD_VIEW_ROLES, GROUP_MANAGE_ROLES, SUPERVISOR_ELIGIBLE_ROLES } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await requireRole([...new Set([...SD_VIEW_ROLES, ...GROUP_MANAGE_ROLES])]); if (g.error) return g.error;
  const periodId = new URL(req.url).searchParams.get('periodId') || (await openPeriod())?.id;
  if (!periodId) return NextResponse.json([]);
  const rows = await prisma.supervisorAssignment.findMany({
    where: { periodId, active: true },
    include: { supervisor: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true, level: true } }, _count: { select: { evaluations: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const scope = scopeOf(g.session);
  return NextResponse.json(rows.filter(r => inScope(scope, r.teacher.level)));
}

// Assign a supervisor to a teacher. Independent of group and category.
export async function POST(req: Request) {
  const g = await requirePermission('supervisors'); if (g.error) return g.error;
  const { periodId, supervisorId, teacherId } = await req.json();
  const period = periodId && (await prisma.evalPeriod.findUnique({ where: { id: periodId } }));
  if (!period) return fail('Period not found.', 404);
  if (period.status === 'CLOSED') return fail('This period is closed.', 409);
  if (supervisorId === teacherId) return fail('A teacher cannot supervise themselves.');
  const [sup, teacher] = await Promise.all([prisma.user.findUnique({ where: { id: supervisorId } }), prisma.user.findUnique({ where: { id: teacherId } })]);
  if (!sup || !SUPERVISOR_ELIGIBLE_ROLES.includes(sup.role)) return fail('That user cannot be a supervisor.');
  if (!teacher || teacher.role !== 'TEACHER' || !isSdUser(teacher)) return fail('The target must be an SD / TK teacher.');
  const sc = scopeOf(g.session);
  if (!inScope(sc, teacher.level) || !inScope(sc, sup.level)) return fail('You can only assign supervisors within your own school.', 403);
  const a = await prisma.supervisorAssignment.upsert({
    where: { periodId_supervisorId_teacherId: { periodId, supervisorId, teacherId } },
    update: { active: true, assignedById: g.session.id },
    create: { periodId, supervisorId, teacherId, assignedById: g.session.id },
  });
  await writeAudit(g.session, 'SD_SUPERVISOR_ASSIGNED', 'SupervisorAssignment', a.id, { periodId, supervisorId, teacherId });
  return NextResponse.json(a);
}

// Remove = deactivate, so submitted evaluations keep their assignment record.
export async function DELETE(req: Request) {
  const g = await requirePermission('supervisors'); if (g.error) return g.error;
  const id = new URL(req.url).searchParams.get('id');
  const a = id && (await prisma.supervisorAssignment.findUnique({ where: { id }, include: { period: true } }));
  if (!a) return fail('Assignment not found.', 404);
  if (a.period.status === 'CLOSED') return fail('This period is closed.', 409);
  await prisma.supervisorAssignment.update({ where: { id: a.id }, data: { active: false } });
  await writeAudit(g.session, 'SD_SUPERVISOR_REMOVED', 'SupervisorAssignment', a.id, { supervisorId: a.supervisorId, teacherId: a.teacherId });
  return NextResponse.json({ ok: true });
}
