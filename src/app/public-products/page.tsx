// src/app/products/page.tsx
import React from "react";
import { mockProducts } from "@/lib/data";

export default function ProductsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Products (debug list)</h1>
      <p>Click any product name below. It should go to /products/&lt;id&gt;.</p>

      <ul style={{ marginTop: 16 }}>
        {mockProducts.map((product) => (
          <li key={product.id} style={{ marginBottom: 8 }}>
            {/* plain HTML link, no fancy components */}
            <a
              href={`/public-products/${product.id}`}
              style={{ color: "blue", textDecoration: "underline", cursor: "pointer" }}
            >
              {product.name}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
