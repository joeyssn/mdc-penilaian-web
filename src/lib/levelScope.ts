import { prisma } from '@/lib/prisma';
import { inScope, type Level } from '@/lib/levelScopeCore';

export * from '@/lib/levelScopeCore';

// Keep only rows whose user (looked up by id) belongs to the viewer's school.
export async function filterRowsByUserScope<T>(scope: Level | null, rows: T[], idOf: (r: T) => string): Promise<T[]> {
  if (!scope) return rows;
  const users = await prisma.user.findMany({ where: { id: { in: rows.map(idOf) } }, select: { id: true, level: true } });
  const ok = new Set(users.filter(u => inScope(scope, u.level)).map(u => u.id));
  return rows.filter(r => ok.has(idOf(r)));
}
