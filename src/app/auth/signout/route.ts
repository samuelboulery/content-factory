import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 : convertit le POST en GET vers /login.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
