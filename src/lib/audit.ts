import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/session';

// Append-only audit trail. There is intentionally no update/delete helper.
export async function writeAudit(
  actor: SessionUser,
  action: string,
  entityType: string,
  entityId?: string,
  detail?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      detail: detail as any,
    },
  });
}
