import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const semester = searchParams.get('semester');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || 'ALL';

    // 1. Fetch distinct semester names for dropdown filter
    const distinctSemesters = await prisma.semesterArchive.findMany({
      select: { semester: true },
      distinct: ['semester'],
      orderBy: { archivedAt: 'desc' },
    });

    const semesterList = distinctSemesters.map((s) => s.semester);
    const activeSemester = semester || semesterList[0] || '';

    if (!activeSemester) {
      return NextResponse.json({
        semesters: [],
        records: [],
      });
    }

    // 2. Build filter clause
    const whereClause: any = {
      semester: activeSemester,
    };

    if (role !== 'ALL') {
      whereClause.targetRole = role;
    }

    if (search.trim() !== '') {
      whereClause.targetName = {
        contains: search.trim(),
      };
    }

    // 3. Fetch filtered archive records
    const records = await prisma.semesterArchive.findMany({
      where: whereClause,
      orderBy: { targetName: 'asc' },
    });

    return NextResponse.json({
      semesters: semesterList,
      activeSemester,
      records,
    });
  } catch (error: any) {
    console.error("❌ ARCHIVE FETCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch semester archive history: " + error.message },
      { status: 500 }
    );
  }
}