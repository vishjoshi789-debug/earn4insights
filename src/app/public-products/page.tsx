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
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-2">Products</h1>
        <p className="text-muted-foreground mb-8">
          Browse our products and share your feedback to earn rewards.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProducts.map((product) => {
            const imageUrl = productImages[product.imageId] || `https://picsum.photos/seed/${product.id}/400/250`;
            return (
              <Link
                key={product.id}
                href={`/public-products/${product.id}`}
                className="group block rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="p-4 space-y-2">
                  <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                    {product.name}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                  <p className="text-lg font-bold text-primary">
                    ${product.price.toFixed(2)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
