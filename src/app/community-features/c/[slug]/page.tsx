import React from "react";

export default function SlugPage({ params }: { params: any }) {
  const { slug } = params as { slug: string };

  return (
    <main>
      <header>
        <h1>Community — {slug}</h1>
      </header>

      <section>
        <p>This is the slug-level page for: {slug}</p>
      </section>
    </main>
  );
}
