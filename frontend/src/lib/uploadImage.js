import { supabase } from "./supabaseClient";

// Rejected in the browser before the upload starts. Supabase's own bucket
// limit produces an error the user cannot interpret, and a 40MB photo would
// otherwise be sent in full before failing.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

/**
 * Upload a profile image and return its public URL.
 *
 * The storage path is scoped by the user's own Supabase id so the bucket's
 * row-level policies can restrict writes to that user's own folder.
 */
export async function uploadProfileImage(file, kind, userId) {
  if (!userId) throw new Error("You must be signed in to upload an image.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Images must be under ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB.`);
  }

  // Derived from the filename but never trusted: an unrecognised or absent
  // extension falls back to a safe default rather than going into the
  // storage path verbatim.
  const rawExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extension = ALLOWED_EXTENSIONS.has(rawExtension) ? rawExtension : "png";

  const path = `${userId}/${kind}.${extension}`;

  const { error } = await supabase.storage
    .from("profile-images")
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });

  if (error) throw new Error(error.message || "Upload failed.");

  const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
  // Cache-bust: re-uploading to the same path keeps the same URL, so
  // browsers would otherwise keep showing the previous image.
  return `${data.publicUrl}?v=${Date.now()}`;
}
