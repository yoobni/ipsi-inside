import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@ipsi/lib/supabase/server";

async function signoutAndRedirect(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  return signoutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signoutAndRedirect(request);
}
