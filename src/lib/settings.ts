import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/session';
import { isSdGroupLevel } from '@/lib/weights';

const LEGACY_LOCK_KEY = 'scoresLocked';

// Whether this user's results are currently hidden.
// - If cycles exist: the user sees scores only when every OPEN cycle for their school level is unlocked.
//   Users without a school level are checked against all open cycles. No open cycle means locked.
// - If no cycle has ever been created: falls back to the old global switch (locked unless set to 'false').
export async function isScoresLockedFor(user: Pick<SessionUser, 'level'>): Promise<boolean> {
  const totalCycles = await prisma.evaluationCycle.count();
  if (totalCycles === 0) {
    const row = await prisma.appSetting.findUnique({ where: { key: LEGACY_LOCK_KEY } });
    return row ? row.value !== 'false' : true;
  }
  const level = user.level ? (isSdGroupLevel(user.level) ? 'SD' : String(user.level).toUpperCase()) : null;
  const cycles = await prisma.evaluationCycle.findMany({
    where: { status: 'OPEN', ...(level ? { schoolLevel: level } : {}) },
    select: { scoresLocked: true },
  });
  if (cycles.length === 0) return true;
  return cycles.some(c => c.scoresLocked);
}
