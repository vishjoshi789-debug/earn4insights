'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LaunchProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Launch a Product</h1>
        <p className="text-muted-foreground">
          Add a new product to start collecting feedback, NPS, and social insights.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Product name"
          />

          <textarea
            className="w-full border rounded px-3 py-2"
            placeholder="Product description"
            rows={4}
          />

          <Button disabled>Next (Coming Soon)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
