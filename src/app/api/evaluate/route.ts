import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toStoredScore } from '@/lib/scoreScale';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
  try {
    // The grader is the logged-in user, never whatever id the browser sends
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { targetId, scores } = body;
    const graderId = session.id;

    // Self-reflection is for non-student users only
    if (targetId === graderId && session.role === 'STUDENT') {
      return NextResponse.json({ error: "Students cannot submit self-reflection." }, { status: 403 });
    }

    // 1. Validate that we received all the necessary data
    if (!targetId || !scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: "Missing required fields (targetId or scores array)" }, 
        { status: 400 }
      );
    }

    // Scores arrive as 1-4 and are stored as A-D (4 = A ... 1 = D)
    const invalid = scores.find((s: any) => !toStoredScore(s.value));
    if (invalid) {
      return NextResponse.json({ error: "Every score must be a number from 1 to 4." }, { status: 400 });
    }

    // 2. Loop through every question (indicator) answered and save it to the database
    const savedScores = await Promise.all(
      scores.map(async (score) => {
        return prisma.score.create({
          data: {
            graderId: graderId,
            targetId: targetId,
            indicatorId: score.indicatorId,
            value: toStoredScore(score.value)!, // 1-4 from the form, stored as A-D
          }
        });
      })
    );

    // 3. Tell the frontend it was a success!
    return NextResponse.json({ 
      message: "Evaluation submitted successfully", 
      savedCount: savedScores.length 
    }, { status: 200 });

  } catch (error) {
    console.error("❌ EVALUATION SAVE ERROR:", error);
    return NextResponse.json({ error: "Failed to save evaluation to the database" }, { status: 500 });
  }
}