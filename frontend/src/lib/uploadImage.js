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

// Path is scoped by the user's own supabase id so the storage policies
// (see profile-images bucket setup) can restrict writes to their own folder.
export async function uploadProfileImage(file, kind, userId) {
  let uploadFile = file;
  let ext = file.name.split(".").pop();

  try {
    uploadFile = await toResizedJpeg(file);
    ext = "jpg";
  } catch {
  }

  const path = `${userId}/${kind}.${ext}`;

  const { error } = await supabase.storage
    .from("profile-images")
    .upload(path, uploadFile, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
  // Cache-bust: re-uploading to the same path keeps the same URL, so
  // browsers would otherwise keep showing the old cached image.
  return `${data.publicUrl}?t=${Date.now()}`;
}
