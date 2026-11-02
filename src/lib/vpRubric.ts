import { prisma } from '@/lib/prisma';

// The admin decides, per school, whether that school's vice principals may assign rubrics (who evaluates whom). Off by default.
export const VP_RUBRIC_KEY = (level?: string | null) => `vpRubric:${String(level ?? '').toUpperCase()}`;

export async function vpMayAssignRubrics(level?: string | null): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: VP_RUBRIC_KEY(level) } }).catch(() => null);
  return row?.value === 'true';
}
