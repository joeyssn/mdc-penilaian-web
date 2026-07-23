import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Get Total User Counts
    const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });
    const totalTeachersStaff = await prisma.user.count({
      where: { role: { in: ['TEACHER', 'STAFF'] } }
    });

    // 2. Find who has actually submitted an evaluation
    const submittedGrades = await prisma.score.groupBy({
      by: ['graderId'],
    });

    const activeGraderIds = submittedGrades.map(g => g.graderId);

    // 3. Count active graders by role
    const activeStudents = await prisma.user.count({
      where: {
        id: { in: activeGraderIds },
        role: 'STUDENT'
      }
    });

    const activeTeachersStaff = await prisma.user.count({
      where: {
        id: { in: activeGraderIds },
        role: { in: ['TEACHER', 'STAFF'] }
      }
    });

    // 4. Send both totals AND chart data
    return NextResponse.json({
      totals: {
        totalStudents,
        activeStudents,
        totalTeachersStaff,
        activeTeachersStaff,
        overallTotal: totalStudents + totalTeachersStaff,
        overallActive: activeStudents + activeTeachersStaff
      },
      studentStats: [
        { name: 'Completed', value: activeStudents, fill: '#008c99' },
        { name: 'Pending', value: totalStudents - activeStudents, fill: '#e2e8f0' }
      ],
      teacherStats: [
        { name: 'Completed', value: activeTeachersStaff, fill: '#d49a37' },
        { name: 'Pending', value: totalTeachersStaff - activeTeachersStaff, fill: '#e2e8f0' }
      ]
    });

  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}