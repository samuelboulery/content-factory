import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace";

/**
 * Confirmation magic link.
 * Gère le flux PKCE (?code → exchangeCodeForSession) et, en secours,
 * le flux token_hash (?token_hash&type → verifyOtp).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  let authed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authed = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    authed = !error;
  }

  if (authed) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Bootstrap : crée le workspace TDS au 1er login (séquentiel, pas de race au rendu).
      await resolveActiveWorkspace(supabase, user.id);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
