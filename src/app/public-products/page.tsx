import React from "react";
import Link from "next/link";
import { mockProducts } from "@/lib/data";

const productImages: Record<string, string> = {
  'product-smartwatch': 'https://picsum.photos/seed/smartwatch/400/250',
  'product-headphones': 'https://picsum.photos/seed/headphones/400/250',
  'product-camera': 'https://picsum.photos/seed/camera/400/250',
  'product-shoes': 'https://picsum.photos/seed/shoes/400/250',
  'product-drone': 'https://picsum.photos/seed/drone/400/250',
  'product-skincare': 'https://picsum.photos/seed/skincare/400/250',
};

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Hero section */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-3">Products</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Browse our products and share your feedback to earn rewards.
          </p>
          <div className="mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-primary to-secondary" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProducts.map((product) => {
            const imageUrl = productImages[product.imageId] || `https://picsum.photos/seed/${product.id}/400/250`;
            return (
              <Link
                key={product.id}
                href={`/public-products/${product.id}`}
                className="group block rounded-xl border border-border bg-card shadow-sm hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 overflow-hidden"
              >
                <div className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-5 space-y-2">
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {product.name}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-lg font-bold text-primary">
                      ${product.price.toFixed(2)}
                    </p>
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      View details →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
