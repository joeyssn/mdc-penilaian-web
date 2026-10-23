import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { editArchivedScore, editArchivedSdAnswer } from '@/lib/archive';
import { toNumericScore } from '@/lib/scoreScale';

export const dynamic = 'force-dynamic';

// Edit one archived score. ADMIN only; every change is written to the audit log with the old and new value.
// body: { recordId, kind: 'score', scoreId, value } | { recordId, kind: 'sd', evaluationId, indicatorId, value }
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Only the admin can edit archived scores.' }, { status: 403 });

  try {
    const b = await req.json();
    const rec = await prisma.semesterArchive.findUnique({ where: { id: b.recordId } });
    if (!rec) return NextResponse.json({ error: 'Archive record not found.' }, { status: 404 });
    const value = Number(b.value);

    if (b.kind === 'score') {
      const rows = Array.isArray(rec.scoresData) ? (rec.scoresData as any[]) : [];
      const { next, before } = editArchivedScore(rows, b.scoreId, value);
      await prisma.semesterArchive.update({ where: { id: rec.id }, data: { scoresData: next } });
      await writeAudit(session, 'ARCHIVE_SCORE_EDITED', 'SemesterArchive', rec.id, { semester: rec.semester, target: rec.targetName, scoreId: b.scoreId, from: toNumericScore(before), to: value });
    } else if (b.kind === 'sd') {
      const rows = Array.isArray(rec.sdData) ? (rec.sdData as any[]) : [];
      const { next, before } = editArchivedSdAnswer(rows, b.evaluationId, b.indicatorId, value);
      await prisma.semesterArchive.update({ where: { id: rec.id }, data: { sdData: next } });
      await writeAudit(session, 'ARCHIVE_SD_SCORE_EDITED', 'SemesterArchive', rec.id, { semester: rec.semester, target: rec.targetName, evaluationId: b.evaluationId, indicatorId: b.indicatorId, from: before, to: value });
    } else {
      return NextResponse.json({ error: 'kind must be "score" or "sd".' }, { status: 400 });
    }
    const updated = await prisma.semesterArchive.findUnique({ where: { id: rec.id } });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Could not edit the archived score.' }, { status: 400 });
  }
}
