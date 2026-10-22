import { getSession } from '@/lib/session';
import { filterRowsByUserScope, scopeOf } from '@/lib/levelScope';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const absences = await prisma.absence.findMany({ orderBy: { userName: 'asc' } });
    // HRD is shared across schools; a school's principal / admin only sees their own people
    return NextResponse.json(await filterRowsByUserScope(scopeOf(session), absences, a => a.userId));
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch absences" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, userName, role, attendanceScore } = await req.json();
    const existingRecord = await prisma.absence.findFirst({ where: { userId: userId } });

    let savedRecord;
    if (existingRecord) {
      savedRecord = await prisma.absence.update({
        where: { id: existingRecord.id },
        data: { attendanceScore: Number(attendanceScore) }
      });
    } else {
      savedRecord = await prisma.absence.create({
        data: { userId, userName, role, attendanceScore: Number(attendanceScore) }
      });
    }
    return NextResponse.json(savedRecord);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save absence" }, { status: 500 });
  }
}