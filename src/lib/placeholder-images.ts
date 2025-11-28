// ✅ Paste from here (at the very top of the file, starting line 1)
import React from "react";

type PageProps = {
  params: Promise<{ id: string }>
};




import data from "./placeholder-images.json";

/**
 * This is the shape your app actually uses in pages:
 * - imageUrl: for <Image src=...>
 * - imageHint: for data-ai-hint
 */
export type ImagePlaceholder = {
  id: number;
  imageUrl: string;
  imageHint?: string;
  alt?: string;
};

// The JSON may contain fields like: id, url, imageUrl, alt, hint...
// We normalize it here so the rest of the app always sees the same shape.
export const PlaceHolderImages: ImagePlaceholder[] = (data as any[]).map(
  (item, index) => {
    const id =
      typeof item.id === "number"
        ? item.id
        : Number.parseInt(String(item.id ?? index + 1), 10);

    const imageUrl =
      typeof item.imageUrl === "string"
        ? item.imageUrl
        : typeof item.url === "string"
        ? item.url
        : "";

    const imageHint =
      typeof item.imageHint === "string"
        ? item.imageHint
        : typeof item.hint === "string"
        ? item.hint
        : typeof item.alt === "string"
        ? item.alt
        : undefined;

    const alt =
      typeof item.alt === "string"
        ? item.alt
        : typeof item.imageHint === "string"
        ? item.imageHint
        : undefined;

    return {
      id,
      imageUrl,
      imageHint,
      alt,
    };
  }
);
