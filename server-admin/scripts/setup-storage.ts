// Creates the public bucket used for profile photos (JPG/PNG, max 2 MB). Safe to run many times.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  const bucket = process.env.SUPABASE_PHOTOS_BUCKET || "profile-photos";
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  const existing = await supabase.storage.getBucket(bucket);
  if (existing.data) {
    console.log(`Bucket "${bucket}" already exists`);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png"],
  });
  if (error) throw error;
  console.log(`Bucket "${bucket}" created`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
