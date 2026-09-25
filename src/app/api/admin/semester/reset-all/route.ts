import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { currentSemester, newSemester } = await req.json();

    if (!currentSemester || !newSemester) {
      return NextResponse.json(
        { error: "Both current and new semester labels are required." },
        { status: 400 }
      );
    }

    // 1. Fetch active data across all scoring & observation tables
    const [users, scores, evalLogs, observations, absences] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      prisma.score.findMany(),
      prisma.evaluationlog.findMany(),
      prisma.observation.findMany(),
      prisma.absence.findMany(),
    ]);

    // 2. Map data per user for archiving
    const archiveRecords = users.map((user) => {
      const userScores = scores.filter((s) => s.targetId === user.id);
      const userEvalLogs = evalLogs.filter((e) => e.targetId === user.id || e.graderId === user.id);
      const userObs = observations.filter((o) => o.targetId === user.id);
      const userAbsence = absences.find((a) => a.userId === user.id);

      return {
        semester: currentSemester,
        targetId: user.id,
        targetName: user.name,
        targetRole: String(user.role),
        scoresData: userScores.length > 0 ? userScores : null,
        evalLogsData: userEvalLogs.length > 0 ? userEvalLogs : null,
        observationsData: userObs.length > 0 ? userObs : null,
        absenceData: userAbsence ? userAbsence : null,
      };
    }).filter(
      (rec) => rec.scoresData || rec.evalLogsData || rec.observationsData || rec.absenceData
    );

    // 3. Execute atomic transaction (Archive -> Wipe Active Evaluation Tables)
    await prisma.$transaction([
      // A. Save snapshots to archive
      ...(archiveRecords.length > 0
        ? [prisma.semesterArchive.createMany({ data: archiveRecords })]
        : []),
      // B. Wipe active evaluation scores and logs
      prisma.score.deleteMany({}),
      prisma.evaluationlog.deleteMany({}),
      prisma.observation.deleteMany({}),
      prisma.absence.deleteMany({}),
    ]);

    return NextResponse.json({
      message: `Successfully archived ${archiveRecords.length} user records for ${currentSemester} and reset active scoring for ${newSemester}!`,
      archivedCount: archiveRecords.length,
      nextSemester: newSemester,
    });
  } catch (error: any) {
    console.error("❌ SEMESTER RESET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to complete semester reset: " + error.message },
      { status: 500 }
    );
  }
}