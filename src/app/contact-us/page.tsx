import React from 'react';

export default function ContactUsPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full bg-card rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-4 text-purple-700">Contact Us</h1>
        <p className="mb-4 text-lg text-muted-foreground">
          For any questions, support, or partnership inquiries, please reach out to us:
        </p>
        <ul className="mb-4 text-lg text-muted-foreground">
          <li><b>Email:</b> <a href="mailto:vishweshwar@earn4insights.com" className="text-purple-600 underline">vishweshwar@earn4insights.com</a></li>
          <li><b>Contact Number:</b> <a href="tel:+918830403955" className="text-purple-600 underline">+91-8830403955</a></li>
        </ul>
        <p className="text-lg text-muted-foreground">
          We aim to respond to all queries within 24 hours. Thank you for your interest in Earn4Insights!
        </p>
      </div>
    </main>
  );
}
