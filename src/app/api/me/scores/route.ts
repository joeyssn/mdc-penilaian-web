import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isScoresLockedFor } from '@/lib/settings';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { toNumericScore } from '@/lib/scoreScale';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Admin can lock scores so users cannot see them yet
    if (!SCORE_VIEWER_ROLES.includes(user.role) && (await isScoresLockedFor(user))) {
      return NextResponse.json({ locked: true });
    }

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

      let totalScore = 0;
      let totalWeight = 0;
      const uniqueGraders = new Set();

      scores.forEach(score => {
        const weight = score.rubricindicator.weight || 1;
        const numValue = toNumericScore(score.value);
        
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