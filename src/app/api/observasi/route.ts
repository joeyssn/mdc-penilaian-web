import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // While scores are locked, only admin/director see everything. Observers (principal / vice
    // principals) still see the observations they wrote, but never ones about themselves.
    let where = {};
    if (!SCORE_VIEWER_ROLES.includes(session.role) && (await isScoresLockedFor(session))) {
      where = { observerId: session.id, NOT: { targetId: session.id } };
    }

    const observations = await prisma.observation.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(observations);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch observations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newObs = await prisma.observation.create({ data });
    return NextResponse.json(newObs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save observation" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, ...updateData } = data;
    const updatedObs = await prisma.observation.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json(updatedObs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update observation" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    await prisma.observation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete observation" }, { status: 500 });
  }
}