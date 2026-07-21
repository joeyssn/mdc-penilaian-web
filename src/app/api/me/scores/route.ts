import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('user_session')?.value;

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = JSON.parse(session);

    // Fetch scores AND include the role of the person who graded them
    const userScores = await prisma.score.findMany({
      where: { targetId: user.id },
      include: {
        rubricindicator: true,
        user_score_graderIdTouser: {
          select: { role: true }
        }
      }
    });

    // Helper function to calculate average for a specific group of scores
    const calculateStats = (scores: any[]) => {
      if (scores.length === 0) return { average: 0, totalEvaluations: 0, letterGrade: '-' };

      const valueMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
      let totalScore = 0;
      let totalWeight = 0;
      const uniqueGraders = new Set();

      scores.forEach(score => {
        const weight = score.rubricindicator.weight || 1;
        const numValue = valueMap[score.value] || 0;
        
        totalScore += numValue * weight;
        totalWeight += weight;
        uniqueGraders.add(score.graderId);
      });

      const average = totalWeight > 0 ? (totalScore / totalWeight) : 0;
      
      let letterGrade = 'D';
      if (average >= 3.5) letterGrade = 'A';
      else if (average >= 2.5) letterGrade = 'B';
      else if (average >= 1.5) letterGrade = 'C';

      return { average, totalEvaluations: uniqueGraders.size, letterGrade };
    };

    // Split the scores based on the grader's role
    const studentScores = userScores.filter(s => s.user_score_graderIdTouser.role === 'STUDENT');
    const peerScores = userScores.filter(s => s.user_score_graderIdTouser.role !== 'STUDENT');

    return NextResponse.json({
      peer: calculateStats(peerScores),
      student: calculateStats(studentScores)
    });

  } catch (error) {
    console.error("FAILED TO FETCH USER SCORES:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}