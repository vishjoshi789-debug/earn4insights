import React from "react";
import { CommunityFeatureTracker } from "./CommunityFeatureTracker";

export default function CommunityFeaturesPage() {
  return (
    <main>
      <CommunityFeatureTracker feature="community_home" />
      <header>
        <h1>Community Features</h1>
      </header>

      <section>
        <p>This is the top-level page for community features.</p>
      </section>
    </main>
  );
}
