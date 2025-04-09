import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // REMOVED: No longer need authOptions directly
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import { logToServer } from "@/lib/logger"; // Import logger

// Ensure Supabase client is available
if (!supabaseAdmin) {
  console.error(
    "FATAL: Supabase client is not initialized. Check environment variables."
  );
  // Optionally throw an error or handle it based on your application needs
  // throw new Error('Supabase client failed to initialize');
}

// Helper to get user address from session
async function getUserAddress() {
  // Fetch session using getServerSession without passing authOptions
  // It will automatically use the options defined in the [...nextauth] route handler
  const session = await getServerSession();
  if (!session?.user?.address) {
    console.warn("No user address found in session");
    return null;
  }
  return session.user.address;
}

// Zod schema for profile data validation
const profileSchema = z.object({
  name: z.string().max(100).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
});

// Define a more specific type for the expected profile data
// This should match the fields selected in selectFields
interface ProfileData {
  address: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  handle: string | null;
  email: string | null;
  tier: string | null;
  location: string | null;
  created_at: string | null;
  // Add other selected fields if any
}

// GET handler to fetch profile (with handle generation)
export async function GET() {
  const userAddress = await getUserAddress();
  if (!userAddress) {
    logToServer("WARN", "Profile GET Failed - Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    logToServer("ERROR", "Profile GET Failed - Supabase Client Unavailable");
    return NextResponse.json(
      { error: "Supabase client not available" },
      { status: 500 }
    );
  }

  const selectFields =
    "address, display_name, bio, avatar_url, handle, email, tier, location, created_at";
  let profileData: ProfileData | null = null; // Use the specific type
  let fetchError: unknown = null; // Use unknown for errors

  try {
    // 1. Try to fetch existing user
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from("users")
      .select(selectFields)
      .eq("address", userAddress)
      .maybeSingle<ProfileData>(); // Specify the return type for maybeSingle

    fetchError = selectError;
    profileData = existingUser;

    // Check fetchError is a valid PostgrestError and handle code
    const isPostgrestError = (
      error: unknown
    ): error is {
      code: string;
      message: string;
      details: string;
      hint: string;
    } => {
      return typeof error === "object" && error !== null && "code" in error;
    };

    if (
      fetchError &&
      isPostgrestError(fetchError) &&
      fetchError.code !== "PGRST116"
    ) {
      throw fetchError; // Rethrow other select errors
    }

    // 2. Handle based on whether user exists
    if (profileData) {
      // User exists
      if (profileData.handle === null) {
        // User exists but handle is null - generate and update
        const generatedHandle = userAddress.slice(-6);
        logToServer("INFO", "Profile GET - Generating handle", {
          address: userAddress,
          handle: generatedHandle,
        });

        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            handle: generatedHandle,
            updated_at: new Date().toISOString(),
          })
          .eq("address", userAddress)
          .select(selectFields) // Select again to get all fields
          .single();

        if (updateError) {
          logToServer("ERROR", "Profile GET - Failed to update handle", {
            address: userAddress,
            error: updateError,
          });
          // Proceed with existing data, or throw?
          // Let's proceed with old data for now, handle might be updated later.
        } else {
          profileData = updatedUser; // Use the updated profile data
          logToServer("INFO", "Profile GET - Handle updated successfully", {
            address: userAddress,
            handle: generatedHandle,
          });
        }
      }
      // else: User exists and handle is already set - do nothing extra
    } else {
      // User does not exist - insert new user with generated handle
      const generatedHandle = userAddress.slice(-6);
      logToServer("INFO", "Profile GET - Inserting new user with handle", {
        address: userAddress,
        handle: generatedHandle,
      });

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          address: userAddress,
          handle: generatedHandle,
          // Add other default fields if necessary, Supabase defaults should cover id, created_at, updated_at
        })
        .select(selectFields)
        .single();

      if (insertError) {
        logToServer("ERROR", "Profile GET - Failed to insert new user", {
          address: userAddress,
          error: insertError,
        });
        throw insertError; // Throw if insert fails
      }
      profileData = newUser; // Use the newly inserted profile data
    }

    // 3. Return the final profile data
    if (!profileData) {
      // This case should ideally not be reached if insert/update worked
      logToServer("ERROR", "Profile GET - Profile data is unexpectedly null", {
        address: userAddress,
      });
      return NextResponse.json(
        { error: "Failed to retrieve profile data" },
        { status: 500 }
      );
    }

    logToServer("INFO", "Profile GET Success", { address: userAddress });
    // Map Supabase columns to frontend expectations
    return NextResponse.json({
      name: profileData.display_name,
      bio: profileData.bio,
      pfp_url: profileData.avatar_url,
      handle: profileData.handle,
      email: profileData.email,
      tier: profileData.tier,
      location: profileData.location,
      created_at: profileData.created_at,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch profile";
    console.error("GET /api/profile error:", err);
    logToServer("ERROR", "Profile GET Failed", {
      address: userAddress,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST handler to update profile
export async function POST(req: Request) {
  const userAddress = await getUserAddress();
  if (!userAddress) {
    logToServer("WARN", "Profile POST Failed - Unauthorized");
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

      // Upload the new file
      const { error: uploadError } = await supabaseAdmin.storage
        .from("post_images")
        .upload(filePath, pfpFile, { upsert: true, contentType: pfpFile.type });

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
