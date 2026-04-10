import React from "react";

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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
