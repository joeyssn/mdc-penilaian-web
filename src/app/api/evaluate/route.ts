import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // We expect the frontend to send who is grading, who is being graded, and the list of scores
    const { graderId, targetId, scores } = await req.json();

    if (!graderId || !targetId || !scores || scores.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Process all scores in a single database transaction
    const upsertPromises = scores.map((score: { indicatorId: string, value: 'A'|'B'|'C'|'D' }) => {
      return prisma.score.upsert({
        where: {
          targetId_graderId_indicatorId: {
             targetId: targetId,
             graderId: graderId,
             indicatorId: score.indicatorId
          }
        },
        update: {
          value: score.value
        },
        create: {
          id: crypto.randomUUID(),
          targetId: targetId,
          graderId: graderId,
          indicatorId: score.indicatorId,
          value: score.value
        }
      });
    });

    await prisma.$transaction(upsertPromises);

    return NextResponse.json({ message: "Evaluation saved successfully!" });
  } catch (error) {
    console.error("❌ SCORE SUBMISSION ERROR:", error);
    return NextResponse.json({ error: "Failed to save scores" }, { status: 500 });
  }
}