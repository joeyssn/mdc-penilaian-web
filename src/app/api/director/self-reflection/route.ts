import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    // 1. Fetch all staff members that the director oversees
    const users = await prisma.user.findMany({
      where: { 
        role: { in: ['TEACHER', 'STAFF', 'PRINCIPAL'] } 
      },
      select: { id: true, name: true, role: true, gender: true },
      orderBy: { name: 'asc' }
    });

    // 2. Map through each user and check if they have self-reflection scores this year
    const overviewData = await Promise.all(users.map(async (user) => {
      // Find any score where this user graded themselves
      const selfScores = await prisma.score.findMany({
        where: {
          graderId: user.id,
          targetId: user.id,
          createdAt: {
            gte: startOfYear,
            lte: endOfYear
          }
        },
        select: { value: true } // We just need to know they exist, and maybe their values
      });

      // Calculate a basic average if they completed it (A=4, B=3, C=2, D=1)
      let average = 0;
      if (selfScores.length > 0) {
        const total = selfScores.reduce((sum, score) => {
          if (score.value === 'A') return sum + 4;
          if (score.value === 'B') return sum + 3;
          if (score.value === 'C') return sum + 2;
          if (score.value === 'D') return sum + 1;
          return sum;
        }, 0);
        average = total / selfScores.length;
      }

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        gender: user.gender,
        hasCompleted: selfScores.length > 0,
        averageScore: average.toFixed(2),
        questionsAnswered: selfScores.length
      };
    }));

    return NextResponse.json(overviewData);
  } catch (error) {
    console.error("DIRECTOR OVERVIEW ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch overview data" }, { status: 500 });
  }
}