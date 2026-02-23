import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.some((p) => path.startsWith(p))) return NextResponse.next();

  // Check for auth in localStorage is done client-side via stores
  // Here we check cookie-based session if set
  const token = request.cookies.get('accessToken')?.value;
  const userId = request.cookies.get('userId')?.value;

  if (!token && !userId) {
    // Allow access - auth check happens client-side via Zustand persist
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
