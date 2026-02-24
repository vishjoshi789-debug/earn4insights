import data from "./placeholder-images.json";

export type ImagePlaceholder = {
  id: number;
  imageUrl: string;      // always a string for <Image src=...>
  imageHint?: string;
  alt?: string;
};

// Normalize whatever is in placeholder-images.json into the shape above
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
