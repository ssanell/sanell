import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/profile", "/tools/image-host", "/admin"];
const AUTH_ROUTES = ["/login"];

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Set cookies on both the request and response so the
          // session is refreshed and available to server components
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This refreshes the session if expired and returns the user
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (!user && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/profile", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};