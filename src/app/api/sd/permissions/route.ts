import { NextResponse } from 'next/server';
import { adminPermissions, fail, requireRole, setAdminPermission, type SdPermission } from '@/lib/sd/access';
import { writeAudit } from '@/lib/audit';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return fail('Not authenticated', 401);
  return NextResponse.json({ adminSd: await adminPermissions(), mayDelegate: session.role === 'PRINCIPAL' });
}

// Only the Principal decides what Admin SD may do beyond editing drafts.
export async function PUT(req: Request) {
  const g = await requireRole(['PRINCIPAL']); if (g.error) return g.error;
  const { permission, value } = await req.json();
  if (!['publish', 'supervisors', 'periods'].includes(permission)) return fail('Unknown permission.');
  await setAdminPermission(permission as SdPermission, !!value);
  await writeAudit(g.session, 'SD_ADMIN_PERMISSION', 'AppSetting', permission, { value: !!value });
  return NextResponse.json({ ok: true });
}
