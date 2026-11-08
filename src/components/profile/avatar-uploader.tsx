"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils/format";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const OUTPUT_SIZE = 256;

/** Crops the centre square of an image and re-encodes it as WebP (client-side, canvas). */
export async function cropToSquareWebp(file: File, size = OUTPUT_SIZE): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image."));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("Could not process that image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  userId: string;
  name: string;
  value: string;
  onChange: (url: string) => void;
};

export function AvatarUploader({ userId, name, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Please choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That image is larger than 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const blob = await cropToSquareWebp(file);
      if (blob.size > MAX_BYTES) throw new Error("That image is too large after processing.");
      const path = `${userId}/avatar-${Date.now()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
      if (error) throw new Error("Upload failed. Please try again.");
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Avatar uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 border">
        {value ? <AvatarImage src={value} alt="" /> : null}
        <AvatarFallback className="text-lg font-semibold">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id={`avatar-${userId}`}
          aria-label="Upload profile photo"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
          {value ? "Change photo" : "Upload photo"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange("")}>
            <Trash2 className="size-4" aria-hidden /> Remove
          </Button>
        ) : null}
        <p className="w-full text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB. Cropped to a square.</p>
      </div>
    </div>
  );
}
