import { supabase } from "./supabaseClient";

// Path is scoped by the user's own supabase id so the storage policies
// (see profile-images bucket setup) can restrict writes to their own folder.
export async function uploadProfileImage(file, kind, userId) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${kind}.${ext}`;

  const { error } = await supabase.storage
    .from("profile-images")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
  // Cache-bust: re-uploading to the same path keeps the same URL, so
  // browsers would otherwise keep showing the old cached image.
  return `${data.publicUrl}?t=${Date.now()}`;
}
