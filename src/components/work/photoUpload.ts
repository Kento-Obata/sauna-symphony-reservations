import { supabase } from "@/integrations/supabase/client";
import { WORK_PHOTO_BUCKET } from "./workUtils";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/** スマホの写真は数MBあるので、長辺 1600px の JPEG に縮小してから送る */
const compressImage = async (file: File): Promise<Blob> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    return blob ?? file;
  } catch {
    // 縮小できない形式(一部の HEIC など)はそのまま送る
    return file;
  }
};

/**
 * スタッフのトークンのフォルダに写真をアップロードし、保存パスを返す。
 * storage のポリシーで、有効なトークンのフォルダにしか書き込めない。
 */
export const uploadWorkPhotos = async (token: string, files: File[]) => {
  const paths: string[] = [];
  for (const file of files) {
    const blob = await compressImage(file);
    const ext = blob.type === "image/jpeg" ? "jpg" : file.name.split(".").pop() ?? "jpg";
    const path = `${token}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(WORK_PHOTO_BUCKET)
      .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
};
