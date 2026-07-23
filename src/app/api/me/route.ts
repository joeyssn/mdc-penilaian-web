import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('user_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie.value);

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