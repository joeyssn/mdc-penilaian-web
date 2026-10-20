import { prisma } from '@/lib/prisma';

const LOCK_KEY = 'scoresLocked';

// One switch for the whole app. Scores are hidden from users unless an admin has explicitly unlocked them.
export async function isScoresLocked(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: LOCK_KEY } });
  return row ? row.value !== 'false' : true;
}

// Kept so existing callers keep working; visibility no longer depends on the user.
export async function isScoresLockedFor(_user?: unknown): Promise<boolean> {
  return isScoresLocked();
}

export async function setScoresLocked(locked: boolean) {
  await prisma.appSetting.upsert({
    where: { key: LOCK_KEY },
    update: { value: String(locked) },
    create: { key: LOCK_KEY, value: String(locked) },
  });
}
