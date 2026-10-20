import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { denyUnlessRole } from '@/lib/session';
import { toNumericScore } from '@/lib/scoreScale';

export const dynamic = 'force-dynamic';

const cell = (v: unknown): string | number | boolean => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 32000); // Excel cell limit is 32,767 characters
  return String(v).slice(0, 32000);
};
const date = (v: unknown) => (v ? new Date(v as string).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' }) : '');
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

// Download the ENTIRE semester archive as one Excel file (all semesters, or one with ?semester=).
export async function GET(req: Request) {
  const denied = await denyUnlessRole(['ADMIN', 'DIRECTOR']);
  if (denied) return denied;

  try {
    const semester = new URL(req.url).searchParams.get('semester');
    const archives = await prisma.semesterArchive.findMany({
      where: semester ? { semester } : {},
      orderBy: [{ semester: 'asc' }, { targetName: 'asc' }],
    });
    if (archives.length === 0) {
      return NextResponse.json({ error: 'There is no archived data to export.' }, { status: 404 });
    }

    // Names for ids that only appear as ids inside the snapshots
    const [users, indicators, rubrics] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      prisma.rubricindicator.findMany({ select: { id: true, text: true } }),
      prisma.rubric.findMany({ select: { id: true, title: true } }),
    ]);
    const userById = new Map(users.map(u => [u.id, u]));
    const indicatorText = new Map(indicators.map(i => [i.id, i.text]));
    const rubricTitle = new Map(rubrics.map(r => [r.id, r.title]));
    const nameOf = (id: string) => userById.get(id)?.name ?? '(deleted user)';

    const summary: Record<string, any>[] = [];
    const scores: Record<string, any>[] = [];
    const logs: Record<string, any>[] = [];
    const observations: Record<string, any>[] = [];
    const attendance: Record<string, any>[] = [];
    const seenLogs = new Set<string>(); // an evaluation log is stored under both the grader and the target

    for (const a of archives) {
      const s = asArray(a.scoresData), l = asArray(a.evalLogsData), o = asArray(a.observationsData);
      const att: any = a.absenceData && typeof a.absenceData === 'object' ? a.absenceData : null;

      summary.push({
        Semester: a.semester, Name: a.targetName, Role: a.targetRole,
        'Scores Received': s.length, 'Evaluation Logs': l.length, 'Observations': o.length,
        'Attendance Score': att ? att.attendanceScore : '', 'Archived At': date(a.archivedAt),
      });

      s.forEach((r: any) => scores.push({
        Semester: a.semester, 'Evaluated Person': a.targetName, 'Evaluated Role': a.targetRole,
        'Grader': nameOf(r.graderId), 'Grader Role': userById.get(r.graderId)?.role ?? '',
        'Indicator': indicatorText.get(r.indicatorId) ?? '(deleted indicator)',
        'Score (1-4)': toNumericScore(r.value), 'Stored Letter': r.value, 'Date': date(r.createdAt),
        'Score ID': r.id,
      }));

      l.forEach((r: any) => {
        if (seenLogs.has(r.id)) return;
        seenLogs.add(r.id);
        logs.push({
          Semester: a.semester, 'Grader': nameOf(r.graderId), 'Evaluated Person': nameOf(r.targetId),
          'Rubric': rubricTitle.get(r.rubricId) ?? '(deleted rubric)', 'Date': date(r.createdAt),
        });
      });

      o.forEach((r: any) => observations.push({
        Semester: a.semester, 'Teacher': r.targetName, 'Observer': r.observerName, 'Date': r.date,
        'Class': r.kelas, 'Subject': r.subject, 'Duration': r.duration, 'Topic': r.topic,
        'Final Score': r.finalScore, 'Approved': r.isApproved ? 'Yes' : 'No',
        'Positive Notes': r.notesPositive, 'Improvement Notes': r.notesImprovement,
        'Item Scores (JSON)': r.scores,
      }));

      if (att) attendance.push({
        Semester: a.semester, Name: a.targetName, Role: att.role ?? a.targetRole,
        'Attendance Score': att.attendanceScore, 'Updated': date(att.updatedAt),
      });
    }

    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: Record<string, any>[]) => {
      const data = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)])));
      const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Info: 'No data' }]);
      if (data.length) ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.min(Math.max(k.length + 2, 14), 48) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    add('Summary', summary);
    add('Scores', scores);
    add('Evaluation Logs', logs);
    add('Observations', observations);
    add('Attendance', attendance);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const label = semester ? semester.replace(/[^\w-]+/g, '_') : 'All_Semesters';
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Semester_Archive_${label}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('❌ ARCHIVE EXPORT ERROR:', error);
    return NextResponse.json({ error: 'Failed to export the semester archive: ' + error.message }, { status: 500 });
  }
}
