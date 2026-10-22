import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, SCORE_VIEWER_ROLES } from '@/lib/session';
import { isScoresLockedFor } from '@/lib/settings';
import { toNumericScore } from '@/lib/scoreScale';
import { isSdGroupLevel } from '@/lib/weights';
import { inScope, scopeOf } from '@/lib/levelScope';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const hideScores = !SCORE_VIEWER_ROLES.includes(session.role) && (await isScoresLockedFor(session));

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, role: true, level: true }
    });

    const userMap = new Map();
    allUsers.forEach(u => userMap.set(u.id, u));

    // 🚀 FIX 1: Add BOTH VP roles so they appear as rows in the table
    const scope = scopeOf(session); // a school's principal / admin only sees their own school
    const targetUsers = allUsers.filter(u => inScope(scope, u.level) && 
      ['TEACHER', 'STAFF', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'PRINCIPAL','HRD','KARYAWAN'].includes((u.role || '').toUpperCase())
    );
    const targetIds = targetUsers.map(u => u.id);

    const allScores = await prisma.score.findMany({
      where: { targetId: { in: targetIds } }
    });

    // SD / TK teachers: peer, supervisor and student scores come from the SD evaluation workflow
    // (current period = the open one, else the most recently created), kept as three separate sources.
    const period = (await prisma.evalPeriod.findFirst({ where: { status: 'OPEN' } })) ?? (await prisma.evalPeriod.findFirst({ orderBy: { createdAt: 'desc' } }));
    const sdEvals = period ? await prisma.sdEvaluation.findMany({ where: { periodId: period.id, targetId: { in: targetIds } }, select: { type: true, targetId: true, average: true } }) : [];
    const sdStat = (userId: string, type: string) => {
      const l = sdEvals.filter(e => e.type === type && e.targetId === userId);
      return { avg: l.length ? (l.reduce((a, e) => a + e.average, 0) / l.length).toFixed(1) : '-', count: l.length };
    };

    const getNumericValue = (val: string) => toNumericScore(val);

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
               // 🚀 FIX 2: Add BOTH VP roles here so their scores count as "Peer" scores
               ['TEACHER', 'STAFF', 'VICE_PRINCIPAL_KURIKULUM', 'VICE_PRINCIPAL_KESISWAAN', 'PRINCIPAL','HRD','KARYAWAN'].includes(graderRole.toUpperCase());
      });

      const sd = isSdGroupLevel(user.level) && user.role === 'TEACHER';
      const studentStats = sd ? sdStat(user.id, 'STUDENT') : calculateStats(studentScores);
      const peerStats = sd ? sdStat(user.id, 'PEER') : calculateStats(peerScores);
      const supervisorStats = sd ? sdStat(user.id, 'SUPERVISOR') : { avg: '-', count: 0 };
      const selfStats = calculateStats(selfScores);

      let overallAvg = '-';
      if (userScores.length > 0) {
        const totalOverall = userScores.reduce((sum, s) => sum + getNumericValue(s.value), 0);
        overallAvg = (totalOverall / userScores.length).toFixed(1);
      }

      // 🚀 FIX 3: Make the role look clean on the frontend!
      let displayRole: string = user.role;
      if (user.role === 'VICE_PRINCIPAL_KURIKULUM') displayRole = 'VP Kurikulum';
      if (user.role === 'VICE_PRINCIPAL_KESISWAAN') displayRole = 'VP Kesiswaan';

      if (hideScores) {
        return {
          id: user.id, name: user.name, role: displayRole, roleKey: user.role, level: user.level ?? null, department: '-',
          studentCount: 0, studentAvg: '-', peerCount: 0, peerAvg: '-', supervisorAvg: '-', selfCount: 0, selfAvg: '-', overallAvg: '-',
        };
      }

      return {
        id: user.id,
        name: user.name,
        role: displayRole,
        roleKey: user.role,
        level: user.level ?? null,
        department: '-', 
        studentCount: studentStats.count,
        studentAvg: studentStats.avg,
        peerCount: peerStats.count,
        peerAvg: peerStats.avg,
        supervisorAvg: supervisorStats.avg,
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