import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { email: loginIdentifier, password } = await req.json();

    // DEBUG 1: What is the frontend sending?
    console.log("===================================");
    console.log("👉 1. Trying to login with:", loginIdentifier);
    console.log("👉 2. Password entered:", password);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { nis_niy: loginIdentifier }
        ]
      }
    });

    // DEBUG 2: Did the database find anyone?
    console.log("👉 3. User found in Database?", user ? `YES (${user.name})` : "NO");

    if (user) {
      // DEBUG 3: Compare the passwords side-by-side
      console.log("👉 4. DB Password exactly is:", `'${user.password}'`);
      console.log("👉 5. Typed Password exactly is:", `'${password}'`);
      console.log("👉 6. Do they match?", user.password === password ? "YES" : "NO");
    }
    console.log("===================================");

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials. Please try again." }, { status: 401 });
    }

    const sessionData = {
      id: user.id,
      name: user.name,
      role: user.role,
      gender: user.gender,
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