import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { graderId, targetId, scores } = body;

    // 1. Validate that we received all the necessary data
    if (!graderId || !targetId || !scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: "Missing required fields (graderId, targetId, or scores array)" }, 
        { status: 400 }
      );
    }

    // 2. Loop through every question (indicator) answered and save it to the database
    const savedScores = await Promise.all(
      scores.map(async (score) => {
        return prisma.score.create({
          data: {
            graderId: graderId,
            targetId: targetId,
            indicatorId: score.indicatorId,
            value: score.value, // The A, B, C, or D letter grade
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