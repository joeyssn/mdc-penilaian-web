import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    // The frontend might still send this variable as "email" or "username"
    const { email: rawInput, password } = await req.json();

    if (!rawInput || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // 🚀 THE EMAIL ENFORCER: 
    // If they type "budi", it becomes "budi@mdc.sch.id". 
    // If they type "budi@mdc.sch.id", it stays exactly the same.
    const loginEmail = rawInput.includes('@') 
      ? rawInput.toLowerCase().trim() 
      : `${rawInput.toLowerCase().trim()}@mdc.sch.id`;

    // 1. Find the user STRICTLY by their email address
    const user = await prisma.user.findFirst({
      where: {
        email: loginEmail
      }
    });

    console.log("👉 LOGIN ATTEMPT:", { triedEmail: loginEmail });
    console.log("👉 DATABASE FOUND:", user ? `Yes, User ID: ${user.id}, Role: ${user.role}` : "NO USER FOUND");

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // 2. Safely check the password
    let passwordMatch = false;
    
    // Check if the password in the DB is hashed (starts with $2a$ or $2b$)
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      // Fallback for old unhashed accounts
      passwordMatch = (user.password === password); 
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // 3. Create the secure Session Data
    const sessionData = {
      id: user.id,
      name: user.name,
      role: user.role,
      gender: user.gender,
      department: user.department,
      grade: user.grade, 
      level: user.level,
      className: user.className,
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