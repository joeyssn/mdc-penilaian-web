import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 🚀 Fetch ONLY the roles the Vice-Principal is allowed to see!
    // Notice how we left out 'STUDENT', 'DIRECTOR', and 'ADMIN'
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['TEACHER', 'STAFF', 'VICE_PRINCIPAL', 'PRINCIPAL']
        }
      },
      select: {
        id: true,
        name: true,
        role: true,
        gender: true,
        department: true
      },
      orderBy: {
        name: 'asc' // Sort alphabetically
      }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("❌ FAILED TO FETCH VP TARGETS:", error);
    return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
  }
}