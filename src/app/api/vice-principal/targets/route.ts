import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { inScope, scopeOf } from '@/lib/levelScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const scope = scopeOf(session);
    // 🚀 Fetch ONLY the roles the Vice-Principal is allowed to see!
    // Notice how we left out 'STUDENT', 'DIRECTOR', and 'ADMIN'
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['TEACHER', 'STAFF', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'PRINCIPAL','KARYAWAN']
        }
      },
      select: {
        id: true,
        name: true,
        role: true,
        gender: true,
        department: true,
        level: true
      },
      orderBy: {
        name: 'asc' // Sort alphabetically
      }
    });

    return NextResponse.json(users.filter(u => inScope(scope, u.level)));
  } catch (error) {
    console.error("❌ FAILED TO FETCH VP TARGETS:", error);
    return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { graderId, targetId, scores } = await req.json();

    // Extract just the IDs of the questions being answered
    const indicatorIds = scores.map((s: { indicatorId: string, value: string }) => s.indicatorId);

    // 1. CLEAR OUT OLD SCORES: Delete any existing scores this grader gave this target for these specific questions
    await prisma.score.deleteMany({
      where: {
        graderId: graderId,
        targetId: targetId,
        indicatorId: { in: indicatorIds }
      }
    });

    // 2. SAVE NEW SCORES: Now it's perfectly safe to insert the new ones!
    const scoresToInsert = scores.map((score: { indicatorId: string, value: string }) => ({
      graderId,
      targetId,
      indicatorId: score.indicatorId,
      value: score.value,
    }));

    await prisma.score.createMany({
      data: scoresToInsert
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ EVALUATION SAVE ERROR:", error);
    return NextResponse.json({ error: "Failed to save evaluation" }, { status: 500 });
  }
}