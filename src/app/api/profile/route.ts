/**
 * src/app/api/profile/route.ts
 *
 * API route for fetching and updating the logged-in user's profile.
 * GET: Retrieves profile data, ensuring user/handle exists.
 * POST: Updates profile (name, bio, PFP), handles PFP upload.
 */
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { type NextRequest } from "next/server"; // Need NextRequest for getToken
// import { getServerSession } from "next-auth/next"; // No longer needed for POST
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // REMOVED: No longer need authOptions directly
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import { logToServer } from "@/lib/logger"; // Import logger

// --- Constants (defined globally for potential use in both handlers) --- //
const MAX_PFP_SIZE_MB = 5;
const MAX_PFP_SIZE_BYTES = MAX_PFP_SIZE_MB * 1024 * 1024;
const ALLOWED_PFP_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const PFP_STORAGE_BUCKET = "post_images"; // Ensure this matches your bucket name

// --- Environment Checks --- //
if (!supabaseAdmin) {
  // Logged during client initialization, but double-check
  logToServer(
    "ERROR",
    "API /profile - Supabase client not initialized at route level"
  );
  // Avoid throwing here to allow potential error response
}

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  // Should be caught by auth route startup check, but log defensively
  logToServer("ERROR", "API /profile - NEXTAUTH_SECRET missing");
}

// --- Helper: Get User Address --- //
// Extracts user address (ID) from the session token.
async function getUserAddressFromToken(
  req: NextRequest
): Promise<string | null> {
  if (!secret) {
    // Already logged above
    return null;
  }
  try {
    const token = await getToken({ req, secret });
    if (!token?.sub) {
      logToServer("WARN", "API /profile - No sub (address) found in token", {
        tokenExists: !!token,
      });
      return null;
    }
    return token.sub;
  } catch (error) {
    logToServer("ERROR", "API /profile - Error getting token", { error });
    return null;
  }
}

// --- Zod Schema for Profile Update Data --- //
const profileSchema = z.object({
  name: z.string().max(100).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
});

// --- Type for Supabase User Data (Subset) --- //
// Defines the expected shape of data selected from the users table.
interface ProfileData {
  address: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  handle: string | null;
  // Add other fields if selected in GET handler
  // email: string | null;
  // tier: string | null;
  // location: string | null;
  // created_at: string | null;
}

// === GET Handler: Fetch User Profile === //
export async function GET(request: NextRequest) {
  const userAddress = await getUserAddressFromToken(request);
  if (!userAddress) {
    // getUserAddressFromToken logs details
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    logToServer("ERROR", "Profile GET - Supabase Client Unavailable", {
      address: userAddress,
    });
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Select fields expected by the frontend (/profile page)
  const selectFields = "address, display_name, bio, avatar_url, handle";

  try {
    logToServer("INFO", "Profile GET - Fetching user", {
      address: userAddress,
    });
    // Use const for destructuring, profileData will be shadowed if reassigned
    const { data: initialProfileData, error: selectError } = await supabaseAdmin
      .from("users")
      .select(selectFields)
      .eq("address", userAddress)
      .maybeSingle<ProfileData>();

    if (selectError && selectError.code !== "PGRST116") {
      logToServer("ERROR", "Profile GET - Supabase select error", {
        address: userAddress,
        error: selectError,
      });
      throw selectError;
    }

    // Assign initial data to a mutable variable
    let profileData = initialProfileData;

    // Handle user creation or handle generation if needed
    if (!profileData || !profileData.handle) {
      const isNewUser = !profileData;
      const generatedHandle = userAddress.slice(-6);
      logToServer(
        "INFO",
        `Profile GET - ${isNewUser ? "Inserting user" : "Updating handle"}`,
        { address: userAddress, generatedHandle }
      );

      if (isNewUser) {
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from("users")
          .insert({ address: userAddress, handle: generatedHandle })
          .select(selectFields)
          .single<ProfileData>();
        if (insertError) {
          logToServer("ERROR", "Profile GET - Failed inserting new user", {
            address: userAddress,
            error: insertError,
          });
          throw insertError;
        }
        profileData = newUser;
      } else {
        // Existing user, null handle
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            handle: generatedHandle,
            updated_at: new Date().toISOString(),
          })
          .eq("address", userAddress)
          .select(selectFields)
          .single<ProfileData>();
        if (updateError) {
          logToServer("ERROR", "Profile GET - Failed updating handle", {
            address: userAddress,
            error: updateError,
          });
          throw updateError;
        }
        profileData = updatedUser;
      }
    }

    if (!profileData) {
      // This case should ideally not be reached after the above logic
      logToServer("ERROR", "Profile GET - Profile data unexpectedly null", {
        address: userAddress,
      });
      return NextResponse.json(
        { error: "Failed to retrieve profile data" },
        { status: 500 }
      );
    }

    logToServer("INFO", "Profile GET - Success", { address: userAddress });
    // Map Supabase columns to the specific keys expected by the /profile frontend page
    return NextResponse.json({
      name: profileData.display_name, // Frontend expects 'name'
      bio: profileData.bio,
      pfp_url: profileData.avatar_url, // Frontend expects 'pfp_url'
    });
  } catch (err: unknown) {
    // Catch all errors from the try block (select, insert, update)
    const message =
      err instanceof Error ? err.message : "Failed to fetch profile data";
    logToServer("ERROR", "Profile GET - Exception caught", {
      address: userAddress,
      error: message,
      rawError: err,
    });
    console.error("GET /api/profile error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST handler to update profile
export async function POST(req: NextRequest) {
  const userAddress = await getUserAddressFromToken(req);
  if (!userAddress) {
    logToServer("WARN", "Profile POST Failed - Unauthorized (token check)");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    logToServer("ERROR", "Profile POST Failed - Supabase Client Unavailable");
    return NextResponse.json(
      { error: "Supabase client not available" },
      { status: 500 }
    );
  }

  let pfpFile: File | null = null;
  let profileData: { name?: string | null; bio?: string | null } = {};
  let avatar_url: string | null = null; // Use avatar_url variable

  try {
    const formData = await req.formData();

    // Extract text fields
    const name = formData.get("name") as string | null;
    const bio = formData.get("bio") as string | null;

    // Validate text fields
    const validationResult = profileSchema.safeParse({ name, bio });
    if (!validationResult.success) {
      logToServer("WARN", "Profile POST Failed - Invalid Input", {
        address: userAddress,
        errors: validationResult.error.errors,
      });
      return NextResponse.json(
        { error: "Invalid input data", details: validationResult.error.errors },
        { status: 400 }
      );
    }
    profileData = validationResult.data;

    // Handle file upload
    const file = formData.get("pfp") as File | null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        logToServer("WARN", "Profile POST Failed - File Size Exceeded", {
          address: userAddress,
          size: file.size,
        });
        return NextResponse.json(
          { error: "File size exceeds 5MB limit" },
          { status: 400 }
        );
      }
      if (
        !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
          file.type
        )
      ) {
        logToServer("WARN", "Profile POST Failed - Invalid File Type", {
          address: userAddress,
          type: file.type,
        });
        return NextResponse.json(
          { error: "Invalid file type" },
          { status: 400 }
        );
      }
      pfpFile = file;
    }

    // 1. Upload image if present
    if (pfpFile) {
      const fileExt = pfpFile.name.split(".").pop();
      // Use address in the path for consistency
      const filePath = `${userAddress}/profile.${fileExt}`;
      logToServer("INFO", "Profile POST - Uploading PFP", {
        address: userAddress,
        path: filePath,
      });

      // First, attempt to remove any existing file for the user to prevent orphans
      const { error: removeError } = await supabaseAdmin.storage
        .from("post_images")
        .remove([
          `${userAddress}/profile.jpg`,
          `${userAddress}/profile.png`,
          `${userAddress}/profile.gif`,
          `${userAddress}/profile.webp`,
        ]);
      if (
        removeError &&
        !removeError.message.includes("Bucket not found") &&
        !removeError.message.includes("Not found")
      ) {
        console.warn("Supabase storage remove error (ignored):", removeError);
      }

      // Upload the new file with cache control
      const { error: uploadError } = await supabaseAdmin.storage
        .from("post_images")
        .upload(filePath, pfpFile, {
          upsert: true,
          contentType: pfpFile.type,
          cacheControl: "0",
        });

      if (uploadError) {
        console.error("Supabase storage upload error:", uploadError);
        logToServer("ERROR", "Profile POST Failed - Supabase Storage Upload", {
          address: userAddress,
          error: uploadError,
        });
        throw new Error("Failed to upload profile picture");
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from("post_images")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        console.error("Failed to get public URL for uploaded image");
        logToServer("WARN", "Profile POST - Failed to get PFP public URL", {
          address: userAddress,
          path: filePath,
        });
      } else {
        avatar_url = urlData.publicUrl; // Store in avatar_url
        logToServer("INFO", "Profile POST - PFP Public URL Obtained", {
          address: userAddress,
          url: avatar_url,
        });
      }
    }

    // 2. Update user profile data in the table
    const updatePayload: {
      display_name?: string | null; // Use display_name
      bio?: string | null;
      avatar_url?: string | null; // Use avatar_url
      updated_at: string;
    } = {
      // Map name from frontend back to display_name for Supabase
      display_name: profileData.name,
      bio: profileData.bio,
      updated_at: new Date().toISOString(),
    };
    // Only include avatar_url in the update if a new one was generated
    if (avatar_url) {
      updatePayload.avatar_url = avatar_url; // Use avatar_url
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("address", userAddress) // Update based on address
      .select("display_name, bio, avatar_url") // Select correct columns
      .single();

    if (updateError) {
      console.error("Supabase update error:", updateError);
      logToServer("ERROR", "Profile POST Failed - Supabase DB Update", {
        address: userAddress,
        error: updateError,
      });
      throw new Error("Failed to update profile data");
    }

    if (!updatedUser) {
      logToServer(
        "ERROR",
        "Profile POST Failed - Updated user data not returned",
        { address: userAddress }
      );
      throw new Error("Failed to retrieve updated profile data after update.");
    }

    logToServer("INFO", "Profile POST Success", {
      address: userAddress,
      updatedFields: Object.keys(updatePayload),
    });
    // Map Supabase columns back to frontend expectations
    return NextResponse.json({
      name: updatedUser.display_name, // Map back
      bio: updatedUser.bio,
      pfp_url: updatedUser.avatar_url, // Map back
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update profile";
    console.error("POST /api/profile error:", err);
    logToServer("ERROR", "Profile POST Failed", {
      address: userAddress,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
