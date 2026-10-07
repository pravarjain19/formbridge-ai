import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session cookie on every matched request and keeps
 * signed-out users out of /app. Skipped entirely when Supabase isn't configured
 * so the public pages (calculator, OCR preview) still work locally.
 */
export async function middleware(request: NextRequest) {
  const url = SUPABASE_URL;
  const key = SUPABASE_PUBLIC_KEY;
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith("/app")) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/app")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Skip static assets and the stateless public APIs.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ocr/preview|api/razorpay/webhook|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
