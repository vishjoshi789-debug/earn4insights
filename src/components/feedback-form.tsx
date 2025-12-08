// src/components/feedback-form.tsx
"use client";

import React, { useState } from "react";

type FeedbackFormProps = {
  productId?: string;
};

export function FeedbackForm({ productId }: FeedbackFormProps) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Mock submit – you can replace this with real API later
    console.log("Submitted feedback", {
      productId,
      rating,
      text,
    });

    alert("Feedback submitted (mock).");
    setText("");
    setRating(5);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Rating (1–5)
        </label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Your feedback
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Share your thoughts about this product..."
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium bg-black text-white hover:bg-black/80"
      >
        Submit feedback
      </button>
    </form>
  );
}

// ✅ provide both default *and* named export so any import style works
export default FeedbackForm;
