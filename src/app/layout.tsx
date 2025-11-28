import type { Metadata } from 'next';
import './globals.css';
// --- START: MODIFIED IMPORTS ---
import { Toaster } from '@/components/ui/toaster';
import { ToastProvider } from '@/components/ui/use-toast'; // IMPORTED THE PROVIDER
// --- END: MODIFIED IMPORTS ---
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const metadata: Metadata = {
  title: 'Brand Pulse',
  description:
    'The leading platform for real-time brand-consumer interaction, where product feedback is rewarded and drives business innovation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@400;500;600;700&family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-body antialiased">
        {/* WRAP THE ENTIRE BODY CONTENT WITH THE PROVIDER */}
        <ToastProvider> 
          <div className="relative flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <Toaster /> {/* Toaster is now inside the Provider's scope */}
        </ToastProvider>
      </body>
    </html>
  );
}