import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, indicatorIds } = await req.json();

    const currentYear = new Date().getFullYear();

    // If there's no rubric attached yet, just return false
    if (!indicatorIds || indicatorIds.length === 0) {
      return NextResponse.json({ hasCompletedThisYear: false, year: currentYear });
    }

    // Check if the user has already scored themselves on these indicators
    const existingScore = await prisma.score.findFirst({
      where: {
        graderId: userId,
        targetId: userId, // Self-reflection means grader and target are the same
        indicatorId: { in: indicatorIds }
      }
    });

    return NextResponse.json({ 
      hasCompletedThisYear: !!existingScore, // true if a score exists, false if it doesn't
      year: currentYear 
    });

  } catch (error) {
    console.error("❌ SELF-STATUS ERROR:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}