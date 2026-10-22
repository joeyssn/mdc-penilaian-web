import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inScope, scopeOf } from '@/lib/levelScope';
import { fail, requireRole, SD_VIEW_ROLES, GROUP_MANAGE_ROLES, isSdUser } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

// Candidate lists for the management screens: SD teachers, possible supervisors, students by class.
export async function GET() {
  const g = await requireRole([...new Set([...SD_VIEW_ROLES, ...GROUP_MANAGE_ROLES])]); if (g.error) return g.error;
  const users = await prisma.user.findMany({
    where: { role: { in: ['TEACHER', 'STAFF', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'STUDENT'] } },
    select: { id: true, name: true, role: true, level: true, className: true },
    orderBy: { name: 'asc' },
  });
  const scope = scopeOf(g.session);
  const sd = users.filter(u => isSdUser(u) && inScope(scope, u.level));
  return NextResponse.json({
    teachers: sd.filter(u => u.role === 'TEACHER'),
    supervisors: users.filter(u => u.role !== 'STUDENT' && inScope(scope, u.level)),
    students: sd.filter(u => u.role === 'STUDENT'),
  });
}
