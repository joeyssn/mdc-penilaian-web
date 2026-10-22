import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { validateClasses } from '@/lib/sd/rules';
import { fail, groupScopeWhere, requireRole, GROUP_MANAGE_ROLES, SD_SCHOOLS, SD_VIEW_ROLES } from '@/lib/sd/access';
import { normLevel, scopeOf } from '@/lib/levelScope';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await requireRole([...new Set([...GROUP_MANAGE_ROLES, ...SD_VIEW_ROLES])]); if (g.error) return g.error;
  const periodId = new URL(req.url).searchParams.get('periodId') || undefined;
  const groups = await prisma.teacherGroup.findMany({
    where: { ...(periodId ? { periodId } : {}), ...groupScopeWhere(scopeOf(g.session)) },
    include: { members: { include: { teacher: { select: { id: true, name: true } } }, orderBy: [{ className: 'asc' }, { subject: 'asc' }] } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const g = await requireRole(GROUP_MANAGE_ROLES); if (g.error) return g.error;
  const { name, periodId, classOne, classTwo, level: bodyLevel } = await req.json();
  // A school's own principal / admin creates groups for their school; a global admin picks TK or SD.
  const level = scopeOf(g.session) ?? normLevel(bodyLevel);
  if (!level || !SD_SCHOOLS.includes(level)) return fail('Choose the school (TK or SD) for this group.');
  if (!name?.trim() || !periodId) return fail('Name and period are required.');
  const errs = validateClasses(classOne, classTwo);
  if (errs.length) return fail(errs);
  const period = await prisma.evalPeriod.findUnique({ where: { id: periodId } });
  if (!period) return fail('Period not found.', 404);
  if (period.status === 'CLOSED') return fail('This period is closed.', 409);
  try {
    const grp = await prisma.teacherGroup.create({
      data: { name: name.trim(), periodId, classOne: classOne.trim(), classTwo: classTwo.trim(), level, createdById: g.session.id },
    });
    await writeAudit(g.session, 'SD_GROUP_CREATED', 'TeacherGroup', grp.id, { name: grp.name, classOne: grp.classOne, classTwo: grp.classTwo });
    return NextResponse.json(grp);
  } catch { return fail('A group with this name already exists in the period.', 409); }
}
