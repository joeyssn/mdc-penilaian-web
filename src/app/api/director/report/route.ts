import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, role: true } 
    });

    const userMap = new Map();
    allUsers.forEach(u => userMap.set(u.id, u));

    // Added VICE_PRINCIPAL to targets
    const targetUsers = allUsers.filter(u => 
      ['TEACHER', 'STAFF', 'VICE_PRINCIPAL', 'PRINCIPAL'].includes((u.role || '').toUpperCase())
    );
    const targetIds = targetUsers.map(u => u.id);

    const allScores = await prisma.score.findMany({
      where: { targetId: { in: targetIds } }
    });

    const getNumericValue = (val: string) => {
      if (val === 'A') return 4;
      if (val === 'B') return 3;
      if (val === 'C') return 2;
      if (val === 'D') return 1;
      return 0;
    };

    const calculateStats = (scores: any[]) => {
      if (scores.length === 0) return { avg: '-', count: 0 };
      
      const uniqueGraders = new Set(scores.map(s => s.graderId)).size;
      const totalScore = scores.reduce((sum, s) => sum + getNumericValue(s.value), 0);
      const avg = (totalScore / scores.length).toFixed(1);
      
      return { avg, count: uniqueGraders };
    };

    const reportData = targetUsers.map(user => {
      const userScores = allScores.filter(s => s.targetId === user.id);
      
      const studentScores = userScores.filter(s => {
        const graderRole = userMap.get(s.graderId)?.role || '';
        return graderRole.toUpperCase() === 'STUDENT';
      });
      
      const selfScores = userScores.filter(s => s.graderId === user.id);
      
      const peerScores = userScores.filter(s => {
        const graderRole = userMap.get(s.graderId)?.role || '';
        return s.graderId !== user.id && 
               // Added VICE_PRINCIPAL to Peer evaluators
               ['TEACHER', 'STAFF', 'VICE_PRINCIPAL', 'PRINCIPAL'].includes(graderRole.toUpperCase());
      });

      const studentStats = calculateStats(studentScores);
      const peerStats = calculateStats(peerScores);
      const selfStats = calculateStats(selfScores);

      let overallAvg = '-';
      if (userScores.length > 0) {
        const totalOverall = userScores.reduce((sum, s) => sum + getNumericValue(s.value), 0);
        overallAvg = (totalOverall / userScores.length).toFixed(1);
      }

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        department: '-', 
        studentCount: studentStats.count,
        studentAvg: studentStats.avg,
        peerCount: peerStats.count,
        peerAvg: peerStats.avg,
        selfCount: selfStats.count,
        selfAvg: selfStats.avg,
        overallAvg: overallAvg,
      };
    });

    reportData.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(reportData);

  } catch (error) {
    console.error("DIRECTOR REPORT ERROR:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}