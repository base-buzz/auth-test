import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

// Schema for the handle param
const handleSchema = z.string().min(1);

export async function GET(
  req: NextRequest,
  { params }: { params: { handle: string } }
): Promise<NextResponse> {
  const handle = params.handle;

  const validation = handleSchema.safeParse(handle);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid handle format" },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(
        "address, display_name, avatar_url, bio, handle, created_at, tier"
      )
      .eq("handle", handle)
      .maybeSingle();

    if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
    if (!data)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      address: data.address,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      bio: data.bio,
      handle: data.handle,
      created_at: data.created_at,
      tier: data.tier,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
