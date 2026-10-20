import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const sessionData = await getSession();

    if (!sessionData) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Fetch the FULL user details from the database
    const user = await prisma.user.findUnique({
      where: { id: sessionData.id },
      select: {
        id: true,
        name: true,
        role: true,
        gender: true,
        department: true, // <--- Added this
        grade: true,      // <--- Added this
        level: true,      // <--- Added this
        className: true,  // <--- Added this
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("ME API ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}