import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  // If there's no session and the user is trying to access a protected route
  if (!session && req.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // If there's a session and the user is trying to access the login page
  if (session && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/', '/login'],
}; 