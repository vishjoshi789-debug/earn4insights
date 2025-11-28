import React from "react";

type RouteParams = { slug: string; postId: string };

// NOTE: We deliberately type `params` as `any` so it is compatible with
// Next's generated PageProps (which currently expects params: Promise<any>).
export default async function Page({ params }: { params: any }) {
  const { slug, postId } = params as RouteParams;

  // Example fetch (you can keep your original fetching logic)
  // const data = await fetch(`https://api.example.com/posts/${postId}`).then(res => res.json());

  return (
    <main>
      <header>
        <h1>Community — {slug}</h1>
        <h2>Post: {postId}</h2>
      </header>

      <section>
        {/* Replace this with your real UI */}
        <p>
          This page receives route params as a plain object:{" "}
          <code>{JSON.stringify({ slug, postId })}</code>
        </p>
        {/* Example: render fetched content */}
        {/* <article dangerouslySetInnerHTML={{ __html: data.content }} /> */}
      </section>
    </main>
  );
}
