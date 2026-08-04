import { supabase } from "./supabaseClient";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

// encoding images uploaded via mobile
async function toResizedJpeg(file) {
  const { img, url } = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// `path` (without extension) should already be scoped by whatever owns the
// upload — the user's supabase id for profile images, the room id for
// wallpapers — so each bucket's storage policies can restrict writes to
// the right folder.
async function uploadResizedImage(file, bucket, path) {
  let uploadFile = file;
  let ext = file.name.split(".").pop();

  try {
    uploadFile = await toResizedJpeg(file);
    ext = "jpg";
  } catch {
  }

  const fullPath = `${path}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, uploadFile, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  // Cache-bust: re-uploading to the same path keeps the same URL, so
  // browsers would otherwise keep showing the old cached image.
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadProfileImage(file, kind, userId) {
  return uploadResizedImage(file, "profile-images", `${userId}/${kind}`);
}

export async function uploadRoomWallpaper(file, roomId) {
  return uploadResizedImage(file, "room-wallpapers", `${roomId}/wallpaper`);
}
