import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { 
        role: { in: ['TEACHER', 'STAFF', 'PRINCIPAL'] } 
      },
      include: {
        score_score_targetIdTouser: {
          include: {
            user_score_graderIdTouser: true 
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const reportData = users.map(user => {
      const scores = user.score_score_targetIdTouser;
      
      const uniqueStudentGraders = new Set();
      const uniquePeerGraders = new Set();
      let hasSelfReflection = 0;
      
      let studentScoreTotal = 0;
      let studentIndicatorCount = 0;
      
      let peerScoreTotal = 0;
      let peerIndicatorCount = 0;
      
      let selfScoreTotal = 0;
      let selfIndicatorCount = 0;

      scores.forEach(s => {
        // Convert A,B,C,D into number weights (A=4, B=3, C=2, D=1)
        const weight = s.value === 'A' ? 4 : s.value === 'B' ? 3 : s.value === 'C' ? 2 : 1;
        
        // Categorize graders for counts and specific score averages
        if (s.user_score_graderIdTouser.id === user.id) {
            hasSelfReflection = 1;
            selfScoreTotal += weight;
            selfIndicatorCount++;
        } else if (s.user_score_graderIdTouser.role === 'STUDENT') {
            uniqueStudentGraders.add(s.user_score_graderIdTouser.id);
            studentScoreTotal += weight;
            studentIndicatorCount++;
        } else {
            uniquePeerGraders.add(s.user_score_graderIdTouser.id);
            peerScoreTotal += weight;
            peerIndicatorCount++;
        }
      });

      const totalIndicatorsScored = scores.length;
      const totalWeight = studentScoreTotal + peerScoreTotal + selfScoreTotal;
      
      const overallAvg = totalIndicatorsScored > 0 ? (totalWeight / totalIndicatorsScored).toFixed(2) : '-';
      const studentAvg = studentIndicatorCount > 0 ? (studentScoreTotal / studentIndicatorCount).toFixed(2) : '-';
      const peerAvg = peerIndicatorCount > 0 ? (peerScoreTotal / peerIndicatorCount).toFixed(2) : '-';
      const selfAvg = selfIndicatorCount > 0 ? (selfScoreTotal / selfIndicatorCount).toFixed(2) : '-';

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department || 'UMUM',
        studentCount: uniqueStudentGraders.size,
        peerCount: uniquePeerGraders.size,
        selfCount: hasSelfReflection,
        studentAvg,
        peerAvg,
        selfAvg,
        overallAvg
      };
    });

    return NextResponse.json(reportData);

  } catch (error) {
    console.error("REPORT ERROR:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}