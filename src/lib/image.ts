/**
 * Turning a picture into something safe to store.
 *
 * Pictures live inside the form JSON (for a picture block) or inside a
 * submitted answer (for a photo upload), so both are held as data URLs. A
 * phone camera photo is 4–8 MB, which would bloat every form file and every
 * submission, so everything is redrawn through a canvas at a sane size before
 * it is kept. PNG is preserved when the image has transparency — a logo or a
 * screenshot pasted from Snipping Tool would look wrong flattened onto black.
 */

export interface Picture {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.86;

export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export function isImageFile(f: File | null | undefined): boolean {
  return !!f && f.type.startsWith("image/");
}

/** Load, downscale if needed, and return a data URL. */
export function readPicture(file: File): Promise<Picture> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error("That file is not a picture."));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      reject(new Error("That picture is too large. Try one under 25 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const src = String(reader.result || "");
      const img = new Image();
      img.onerror = () => reject(new Error("That picture could not be opened."));
      img.onload = () => {
        try {
          resolve(redraw(img, src, file.type));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function redraw(img: HTMLImageElement, original: string, mime: string): Picture {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));

  // Small enough already and not a huge PNG — keep the bytes we were given.
  if (scale === 1 && original.length < 900_000) {
    return { dataUrl: original, width: w, height: h, bytes: original.length };
  }

  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This PC could not process the picture.");
  ctx.imageSmoothingQuality = "high";

  // Transparency survives as PNG; a photograph is far smaller as JPEG.
  const keepAlpha = mime === "image/png" || mime === "image/webp" || mime === "image/gif";
  if (!keepAlpha) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(img, 0, 0, outW, outH);

  const dataUrl = keepAlpha
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", JPEG_QUALITY);

  // If "keeping" PNG made it bigger than the JPEG would be, take the JPEG.
  if (keepAlpha && dataUrl.length > 1_400_000) {
    const flat = document.createElement("canvas");
    flat.width = outW;
    flat.height = outH;
    const fctx = flat.getContext("2d");
    if (fctx) {
      fctx.fillStyle = "#FFFFFF";
      fctx.fillRect(0, 0, outW, outH);
      fctx.drawImage(img, 0, 0, outW, outH);
      const jpg = flat.toDataURL("image/jpeg", JPEG_QUALITY);
      if (jpg.length < dataUrl.length)
        return { dataUrl: jpg, width: outW, height: outH, bytes: jpg.length };
    }
  }
  return { dataUrl, width: outW, height: outH, bytes: dataUrl.length };
}

/** The first picture on the clipboard, or null. */
export function pictureFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

/** The first picture in a drag-and-drop, or null. */
export function pictureFromDrop(e: React.DragEvent): File | null {
  const files = e.dataTransfer?.files;
  if (!files) return null;
  for (let i = 0; i < files.length; i++) {
    if (files[i].type.startsWith("image/")) return files[i];
  }
  return null;
}

export function humanSize(bytes: number): string {
  // A data URL is base64, so the real payload is about three-quarters of it.
  const real = Math.round((bytes * 3) / 4);
  if (real < 1024) return `${real} B`;
  if (real < 1024 * 1024) return `${Math.round(real / 1024)} KB`;
  return `${(real / (1024 * 1024)).toFixed(1)} MB`;
}
