import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase et protège les routes.
 * Routes publiques : /login, /auth/*. Les /api/* ne sont pas redirigées
 * (elles gèrent leur propre 401), mais la session y est rafraîchie.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT : ne rien exécuter entre createServerClient et getClaims().
  // getClaims = vérification LOCALE du JWT (signature ES256 via WebCrypto, JWKS en
  // cache 10 min) + refresh auto de la session si proche de l'expiration (via
  // getSession). Sécurisé (vérif cryptographique, pas un simple décodage de cookie)
  // et sans aller-retour réseau vers le serveur Auth à chaque requête —
  // contrairement à getUser. Refresh réseau seulement à l'expiration (~1×/h).
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api") ||
    path.startsWith("/intervenants") ||
    path.startsWith("/invite");

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
