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

    // Explicitly says nothing was stored. The old text ("Feedback submitted
    // (mock).") read as a successful submission to anyone who didn't know
    // what "mock" meant in our codebase.
    alert("Demo form — nothing was submitted or stored.");
    setText("");
    setRating(5);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ⚠️ DEV-ONLY MOCK FORM — submits nothing. Reachable only from the mock
          product pages, which are blocked in production
          (public-products/[id]/page.tsx). Kept honest anyway so the false copy
          can't be revived by a future copy/paste.

          This box used to claim feedback would "Help other users discover
          quality products", implying a public review site. It does not: raw
          feedback goes to the product's brand and nobody else. That copy
          contradicted the two real submission surfaces. */}
      <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500/50 rounded text-sm text-foreground/80">
        <p className="font-semibold text-foreground mb-1">⚠️ Demo form — not a real submission</p>
        <p className="text-xs text-muted-foreground">
          This is sample data for development. Nothing you type here is stored or sent.
        </p>
      </div>

      <div>
        <label htmlFor="feedback-rating" className="block text-sm font-medium text-foreground mb-1">
          Rating (1–5)
        </label>
        <select
          id="feedback-rating"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border border-border bg-muted text-foreground rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="feedback-text" className="block text-sm font-medium text-foreground mb-1">
          Your feedback
        </label>
        <textarea
          id="feedback-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full border border-border bg-muted text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Share your thoughts about this product..."
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Submit feedback
      </button>
    </form>
  );
}

// ✅ provide both default *and* named export so any import style works
export default FeedbackForm;
