import { NextResponse, type NextRequest } from "next/server";
// Import the canonical RouteHandlerContext type
import { type RouteHandlerContext } from "next/dist/server/web/types";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

// Zod schema for validating the handle string itself
const handleSchema = z.string().min(1);

// Remove the unused type alias

export async function GET(
  request: NextRequest,
  context: RouteHandlerContext // Use RouteHandlerContext
) {
  // Log the full request URL and the received context object
  console.log("[API /api/users/[handle]] Request URL:", request.url);
  // Note: context contains more than just params, log the whole thing for debugging if needed
  console.log("[API /api/users/[handle]] Received context object:", context);

  // Validate the handle from context.params
  // Add optional chaining for safety, though params should exist
  const validation = handleSchema.safeParse(context.params?.handle);
  if (!validation.success) {
    console.error(
      "[API /api/users/[handle]] Handle validation failed:",
      validation.error.errors
    );
    return NextResponse.json(
      { error: "Invalid handle format in URL" },
      { status: 400 }
    );
  }
  const handle = validation.data;
  console.log("[API /api/users/[handle]] Validated handle:", handle);

  // Restore Supabase client check and query logic
  if (!supabaseAdmin) {
    console.error(
      "Public user profile fetch failed - Supabase client unavailable"
    );
    return NextResponse.json(
      { error: "Server configuration error" },
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

    if (error) {
      console.error("Supabase error fetching user by handle:", {
        handle,
        error,
      });
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data) {
      console.log(
        "[API /api/users/[handle]] User not found for handle:",
        handle
      );
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("[API /api/users/[handle]] Found user:", data.handle);
    return NextResponse.json({
      address: data.address,
      name: data.display_name,
      pfp_url: data.avatar_url,
      bio: data.bio,
      handle: data.handle,
      created_at: data.created_at,
      tier: data.tier,
    });
  } catch (err: unknown) {
    console.error("Error fetching user profile by handle:", { handle, err });
    const message =
      err instanceof Error ? err.message : "Failed to fetch user profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
