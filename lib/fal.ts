import { fal } from "@fal-ai/client";

fal.config({ credentials: () => process.env.FAL_KEY ?? "" });

interface FalInput {
  prompt: string;
  imageUrls?: string[];
  numImages?: number;
  imageSize?: { width: number; height: number };
}

interface FalImage {
  base64: string;
  mimeType: string;
}

interface FalResult {
  images: FalImage[];
}

async function downloadToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download FAL image: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mimeType: contentType };
}

export async function generateWithFal(input: FalInput): Promise<FalResult> {
  const { prompt, imageUrls, numImages = 1, imageSize } = input;

  const useEdit = imageUrls && imageUrls.length > 0;

  type FalResponse = { data: { images: { url: string }[] } };

  let result: FalResponse;

  if (useEdit) {
    result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
      input: {
        prompt,
        image_urls: imageUrls,
        num_images: numImages,
        ...(imageSize ? { image_size: imageSize } : {}),
      },
    }) as unknown as FalResponse;
  } else {
    result = await fal.subscribe("fal-ai/nano-banana-2", {
      input: {
        prompt,
        num_images: numImages,
        ...(imageSize ? { image_size: imageSize } : {}),
      },
    }) as unknown as FalResponse;
  }

  const rawImages = result.data?.images ?? (result as unknown as { images: { url: string }[] }).images ?? [];

  const images: FalImage[] = await Promise.all(
    rawImages.map((img: { url: string }) => downloadToBase64(img.url)),
  );

  return { images };
}
