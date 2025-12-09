'use client';

import { useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';

import {
  mockProducts,
  mockFeedback,
  mockSocialPosts,
} from '@/lib/data';
import { ProductAnalytics } from '@/components/product-analytics';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function ReportPage() {
  // Read the dynamic route param: /dashboard/report/[id]
  const params = useParams();

  // useParams returns string | string[] | undefined, so normalize it
  const rawId = params?.id;
  const productId =
    typeof rawId === 'string'
      ? rawId
      : Array.isArray(rawId)
      ? rawId[0]
      : '';

  // Find the product
  const product = mockProducts.find((p) => p.id === productId);

  if (!product) {
    // Let Next.js render the 404 page
    notFound();
  }

  // Filter feedback and social posts for this product
  const feedback = mockFeedback.filter(
    (f) => f.productId === productId
  );
  const socialPosts = mockSocialPosts.filter(
    (p) => p.productId === productId
  );

  // Optional: auto-open print dialog (currently disabled)
  useEffect(() => {
    // const timer = setTimeout(() => {
    //   window.print();
    // }, 500);
    // return () => clearTimeout(timer);
  }, []);

  const now = new Date();

  return (
    <div className="bg-background p-8 print:p-0">
      <div className="mx-auto max-w-4xl">
        {/* Top bar – hidden on printed report */}
        <header className="flex items-center justify-between border-b pb-8 print:hidden">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="font-headline text-2xl font-bold">
              Brand Pulse
            </h1>
          </div>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print or Save as PDF
          </Button>
        </header>

        {/* Main report content */}
        <main className="pt-8">
          <div className="mb-8 space-y-2">
            <h2 className="font-headline text-3xl font-bold">
              Detailed Analytics Report
            </h2>
            <p className="text-xl font-semibold text-primary">
              {product.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Report generated on: {now.toLocaleDateString()}
            </p>
          </div>

          <ProductAnalytics
            productId={product.id}
            feedback={feedback}
            socialPosts={socialPosts}
          />
        </main>

        {/* Footer (shown in print too) */}
        <footer className="mt-8 border-t pt-8 text-center text-xs text-muted-foreground">
          &copy; {now.getFullYear()} Brand Pulse | Confidential
          Report
        </footer>
      </div>
    </div>
  );
}
