import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes jo login maangte hain
const PROTECTED_ROUTES = ['/dashboard', '/analytics', '/charts', '/budget'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ye call session ko refresh bhi karta hai (agar token expire ho raha ho)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    path.startsWith(route)
  );

  // Logged in nahi + protected route pe ja raha hai -> login pe bhejo
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Already logged in + /login pe ja raha hai -> dashboard pe bhejo
  if (path === '/login' && session) {
    const redirectUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/analytics/:path*',
    '/charts/:path*',
    '/budget/:path*',
    '/login',
  ],
};