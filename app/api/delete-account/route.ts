import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase configuration for server-side account actions.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { access_token, email } = body as { access_token?: string; email?: string };

  if (!access_token || !email) {
    return NextResponse.json({ error: "access_token and email are required." }, { status: 400 });
  }

  const expectedEmail = email.trim().toLowerCase();

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(access_token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: userError?.message || "Unable to verify user." }, { status: 401 });
  }

  if ((userData.user.email ?? "").trim().toLowerCase() !== expectedEmail) {
    return NextResponse.json({ error: "Email does not match the signed-in account." }, { status: 403 });
  }

  const userId = userData.user.id;

  const { error: deleteRunsError } = await supabaseAdmin.from("runs").delete().eq("user_id", userId);
  if (deleteRunsError) {
    return NextResponse.json({ error: deleteRunsError.message }, { status: 500 });
  }

  const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
