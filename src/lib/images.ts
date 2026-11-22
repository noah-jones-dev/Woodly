/**
 * Turning a user's photo into something an AI provider accepts.
 *
 * Phone photos are often 4000px+ and several MB. Providers cap image size
 * (Anthropic: 5 MB per image, and it downsizes anything over ~1568px on the
 * long edge anyway), so we shrink large photos in the browser first: smaller
 * uploads, lower cost, same detail the model would actually see.
 */
import type { ImageInput } from "@/ai/types";

export type PickedImage = ImageInput & { dataUrl: string };

/** Long-edge limit. Larger photos are scaled down to this before sending. */
export const MAX_IMAGE_EDGE = 1568;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

function readAsDataURL(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error ?? new Error("Couldn't read the file."));
    r.readAsDataURL(f);
  });
}

function splitDataUrl(dataUrl: string): PickedImage {
  const [head, base64] = dataUrl.split(",");
  const mediaType = (/data:(.*?);/.exec(head)?.[1] ?? "image/jpeg") as ImageInput["mediaType"];
  return { mediaType, base64, dataUrl };
}

/** Width/height that fit inside `max` on the long edge, keeping the aspect ratio. */
export function fitWithin(w: number, h: number, max = MAX_IMAGE_EDGE): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/**
 * Read an image file, downscaling it if it's large. Small images and GIFs
 * (which may be animated) are passed through untouched.
 */
export async function fileToImage(f: File): Promise<PickedImage> {
  if (!ACCEPTED.includes(f.type as (typeof ACCEPTED)[number]))
    throw new Error(`“${f.name}” isn't a supported image. Use a PNG, JPEG, WebP or GIF.`);

  const original = await readAsDataURL(f);
  if (f.type === "image/gif" || typeof createImageBitmap !== "function") return splitDataUrl(original);

  try {
    const bmp = await createImageBitmap(f);
    const { w, h } = fitWithin(bmp.width, bmp.height);
    if (w === bmp.width && h === bmp.height && f.size < 3_500_000) {
      bmp.close();
      return splitDataUrl(original);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    // JPEG at 0.85 keeps wood grain and joinery details legible at a fraction of the size.
    return splitDataUrl(canvas.toDataURL("image/jpeg", 0.85));
  } catch {
    return splitDataUrl(original); // decoding failed (e.g. HEIC renamed to .jpg) — let the provider decide
  }
}

/** Strip the preview URL before sending to a provider. */
export const toImageInput = ({ mediaType, base64 }: PickedImage): ImageInput => ({ mediaType, base64 });
