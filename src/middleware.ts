import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Added "default" here to fix the export error
export default function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Identify which zone the user is trying to enter
  const isAdminRoute = path.startsWith('/admin');
  const isTeacherRoute = path.startsWith('/teacher');

  // If it's a public route (like /login or /api), let them pass
  if (!isAdminRoute && !isTeacherRoute) return NextResponse.next();

  // 2. Check for their ID badge (Cookie)
  const sessionCookie = request.cookies.get('user_session')?.value;

  // If no badge, kick them to login
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const user = JSON.parse(sessionCookie);

    // 3. Admin Security Check: Only ADMIN or DIRECTOR can enter /admin
    if (isAdminRoute && user.role !== 'ADMIN' && user.role !== 'DIRECTOR') {
      return NextResponse.redirect(new URL('/teacher', request.url)); 
    }

    // Let them through if they pass the checks!
    return NextResponse.next();
  } catch (error) {
    // If the cookie is corrupted somehow, send them to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Tell the middleware to only run on protected pages
export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*'],
};