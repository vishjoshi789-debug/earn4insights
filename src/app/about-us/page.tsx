import React from 'react';

export default function AboutUsPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-card rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-4 text-purple-700">About Us</h1>
        <p className="mb-4 text-lg text-muted-foreground">
          <b>Earn4Insights</b> is a next-generation platform designed to help brands and creators understand their audience, collect feedback, and make data-driven decisions. Our mission is to empower businesses and individuals to unlock actionable insights from every interaction, survey, and campaign.
        </p>
        <p className="mb-4 text-lg text-muted-foreground">
          With advanced analytics, AI-powered theme extraction, and real-time dashboards, Earn4Insights makes it easy to track engagement, measure satisfaction, and optimize your products or services. Whether you are a startup, established brand, or solo creator, our tools are built to scale with your needs.
        </p>
        <p className="mb-4 text-lg text-muted-foreground">
          We believe in transparency, privacy, and putting users first. Our platform is secure, GDPR-compliant, and constantly evolving to meet the highest standards of data protection and usability.
        </p>
        <p className="text-lg text-muted-foreground">
          Join us on our journey to turn feedback into growth and insights into action!
        </p>
      </div>
    </main>
  );
}
