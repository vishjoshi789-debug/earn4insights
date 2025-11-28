import React from "react";

// Props now explicitly support the `rating` field the products page is using.
type Props = {
  rating?: number;  // primary prop for rating score
  value?: number;   // fallback if used elsewhere
  max?: number;     // total stars
};

function StarRatingComponent({ rating, value, max = 5 }: Props) {
  // Prefer `rating`, fallback to `value`, otherwise 0
  const score = rating ?? value ?? 0;
  const filled = Math.round(score);

  return (
    <div aria-label="star-rating" className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className="text-xl">
          {i < filled ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

// Default export of the component so Next.js recognizes this file as a module.
export default StarRatingComponent;

// Named export so your products page can also import it via:
// import { StarRating } from "@/components/star-rating"
export { StarRatingComponent as StarRating };
