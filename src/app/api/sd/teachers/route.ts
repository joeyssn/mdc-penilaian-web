import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inScope, scopeOf } from '@/lib/levelScope';
import { LEADER_ACCOUNT_ROLES } from '@/lib/sd/rules';
import { fail, requireRole, SD_VIEW_ROLES, GROUP_MANAGE_ROLES, isSdUser } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

// Who can be picked: SD / TK teachers (peers), possible supervisors / koordinators, and students by class.
export async function GET() {
  const g = await requireRole([...new Set([...SD_VIEW_ROLES, ...GROUP_MANAGE_ROLES])]); if (g.error) return g.error;
  const users = await prisma.user.findMany({
    where: { role: { in: [...LEADER_ACCOUNT_ROLES, 'STUDENT'] as any } },
    select: { id: true, name: true, role: true, level: true, className: true },
    orderBy: { name: 'asc' },
  });
  const scope = scopeOf(g.session);
  // SD / TK people only: other schools' staff and teachers never appear here, even for a central admin
  const visible = users.filter(u => isSdUser(u) && inScope(scope, u.level));
  return NextResponse.json({
    teachers: visible.filter(u => u.role === 'TEACHER' && isSdUser(u)),
    leaders: visible.filter(u => u.role !== 'STUDENT'),
    students: visible.filter(u => u.role === 'STUDENT' && isSdUser(u)),
  });
}
