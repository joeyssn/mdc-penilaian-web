import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { email: loginIdentifier, password } = await req.json();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { nis_niy: loginIdentifier }
        ]
      }
    });

console.log("👉 LOGIN ATTEMPT:", { triedEmail: loginIdentifier, triedPassword: password });
    console.log("👉 DATABASE FOUND:", user ? `Yes, User ID: ${user.id}` : "NO USER FOUND");
console.log("👉 PASSWORD MATCH:", user?.password === password ? "YES" : `NO! Database actually has: '${user?.password}'`);
    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials. Please try again." }, { status: 401 });
    }

    // Include the department so the frontend knows if they are IPA or IPS
   // 3. Create the Session Data
// 3. Create the Session Data
    const sessionData = {
      id: user.id,
      name: user.name,
      role: user.role,
      gender: user.gender,
      department: user.department,
      grade: user.grade, 
      level: user.level,
      className: user.className, // <--- ADD THIS
    };

    const cookieStore = await cookies();
    cookieStore.set('user_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 
    });

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}