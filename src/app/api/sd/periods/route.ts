import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { fail, requirePermission } from '@/lib/sd/access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('Not authenticated', 401);
  return NextResponse.json(await prisma.evalPeriod.findMany({ orderBy: { createdAt: 'desc' } }));
}

export async function POST(req: Request) {
  const g = await requirePermission('periods'); if (g.error) return g.error;
  const { name } = await req.json();
  if (!name?.trim()) return fail('Name is required.');
  try {
    const p = await prisma.evalPeriod.create({ data: { name: name.trim() } });
    await writeAudit(g.session, 'SD_PERIOD_CREATED', 'EvalPeriod', p.id, { name: p.name });
    return NextResponse.json(p);
  } catch { return fail('A period with this name already exists.', 409); }
}

// DRAFT -> OPEN -> CLOSED. Only one period may be open at a time.
export async function PATCH(req: Request) {
  const g = await requirePermission('periods'); if (g.error) return g.error;
  const { id, status } = await req.json();
  const p = await prisma.evalPeriod.findUnique({ where: { id } });
  if (!p) return fail('Period not found.', 404);
  const allowed: Record<string, string> = { DRAFT: 'OPEN', OPEN: 'CLOSED' };
  if (allowed[p.status] !== status) return fail(`A ${p.status} period cannot become ${status}.`);
  if (status === 'OPEN' && (await prisma.evalPeriod.findFirst({ where: { status: 'OPEN' } }))) return fail('Another period is already open. Close it first.', 409);
  const u = await prisma.evalPeriod.update({ where: { id }, data: { status } });
  await writeAudit(g.session, `SD_PERIOD_${status}`, 'EvalPeriod', id, { name: p.name });
  return NextResponse.json(u);
}
