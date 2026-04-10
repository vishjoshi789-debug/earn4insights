import React from "react";

type RouteParams = { slug: string; postId: string };

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { slug, postId } = await params;

  return (
    <main>
      <header>
        <h1>Community — {slug}</h1>
        <h2>Post: {postId}</h2>
      </header>

      <section>
        <p>
          This page receives route params as a plain object:{" "}
          <code>{JSON.stringify({ slug, postId })}</code>
        </p>
      </section>
    </main>
  );
}
