import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Await the cookies() function for Next.js 15 compatibility
  const cookieStore = await cookies();
  cookieStore.delete('user_session');
  
  return NextResponse.json({ message: "Logged out successfully" });
}