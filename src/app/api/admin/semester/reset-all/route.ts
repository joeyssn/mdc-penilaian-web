import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { buildLabels } from '@/lib/archive';

export const dynamic = 'force-dynamic';

// Archive everything that is active, verify the archive was written, then clear the active tables.
// All of it happens in ONE transaction: if anything fails, nothing is archived and nothing is deleted.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Only the admin can archive and reset a semester.' }, { status: 403 });

  try {
    const { currentSemester, newSemester } = await req.json();
    if (!currentSemester?.trim() || !newSemester?.trim()) {
      return NextResponse.json({ error: 'Both current and new semester labels are required.' }, { status: 400 });
    }
    if (currentSemester.trim() === newSemester.trim()) {
      return NextResponse.json({ error: 'The new semester must have a different name.' }, { status: 400 });
    }
    const label = currentSemester.trim();
    if ((await prisma.semesterArchive.count({ where: { semester: label } })) > 0) {
      return NextResponse.json({ error: `"${label}" is already archived. Use a different semester name.` }, { status: 409 });
    }

    const [users, scores, evalLogs, observations, absences, sdEvals, indicators, rubrics] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      prisma.score.findMany(),
      prisma.evaluationlog.findMany(),
      prisma.observation.findMany(),
      prisma.absence.findMany(),
      prisma.sdEvaluation.findMany(),
      prisma.rubricindicator.findMany({ select: { id: true, text: true } }),
      prisma.rubric.findMany({ select: { id: true, title: true } }),
    ]);

    // One archive row per person who has anything. Prisma needs Prisma.DbNull / undefined for empty Json columns, never a plain null.
    const records = users.map(user => {
      const userScores = scores.filter(s => s.targetId === user.id);
      const userLogs = evalLogs.filter(e => e.targetId === user.id || e.graderId === user.id);
      const userObs = observations.filter(o => o.targetId === user.id);
      const userAbsence = absences.find(a => a.userId === user.id);
      const userSd = sdEvals.filter(e => e.targetId === user.id);
      if (!userScores.length && !userLogs.length && !userObs.length && !userAbsence && !userSd.length) return null;

      const labels = buildLabels(
        {
          userIds: [...userScores.map(s => s.graderId), ...userLogs.flatMap(l => [l.graderId, l.targetId]), ...userSd.map(e => e.evaluatorId), user.id],
          indicatorIds: [...userScores.map(s => s.indicatorId), ...userSd.flatMap(e => (Array.isArray(e.answers) ? (e.answers as any[]).map(a => a.indicatorId) : []))],
          rubricIds: [...userLogs.map(l => l.rubricId), ...userSd.map(e => e.rubricId)],
        },
        users, indicators, rubrics
      );
      const json = (rows: unknown[]) => (rows.length ? (JSON.parse(JSON.stringify(rows)) as Prisma.InputJsonValue) : undefined);
      return {
        semester: label, targetId: user.id, targetName: user.name, targetRole: String(user.role),
        scoresData: json(userScores), evalLogsData: json(userLogs), observationsData: json(userObs),
        absenceData: userAbsence ? (JSON.parse(JSON.stringify(userAbsence)) as Prisma.InputJsonValue) : undefined,
        sdData: json(userSd), labelsData: labels as unknown as Prisma.InputJsonValue,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    if (records.length === 0) {
      return NextResponse.json({ error: 'There is no active data to archive.' }, { status: 400 });
    }

    await prisma.$transaction(async tx => {
      await tx.semesterArchive.createMany({ data: records });
      const saved = await tx.semesterArchive.count({ where: { semester: label } });
      if (saved !== records.length) throw new Error(`Archive check failed: wrote ${saved} of ${records.length} records.`);
      await tx.score.deleteMany({});
      await tx.evaluationlog.deleteMany({});
      await tx.observation.deleteMany({});
      await tx.absence.deleteMany({});
      await tx.sdEvaluation.deleteMany({});
    }, { timeout: 120000, maxWait: 10000 });

    await writeAudit(session, 'SEMESTER_ARCHIVED', 'SemesterArchive', label, {
      newSemester, records: records.length, scores: scores.length, sdEvaluations: sdEvals.length, observations: observations.length, absences: absences.length,
    });
    return NextResponse.json({
      message: `Archived ${records.length} people for "${label}" (${scores.length} scores, ${sdEvals.length} SD evaluations, ${observations.length} observations). Active scoring is cleared for "${newSemester}".`,
      archivedCount: records.length, nextSemester: newSemester,
    });
  } catch (error: any) {
    console.error('❌ SEMESTER RESET ERROR:', error);
    return NextResponse.json({ error: 'The semester was NOT archived and nothing was deleted. ' + (error?.message ?? '') }, { status: 500 });
  }
}
