import React from 'react';

// Define a simple mock data structure
const mockProducts = [
  { id: 1, name: 'Firebase Studio Theme', price: 49.99 },
  { id: 2, name: 'Next.js Debug Guide', price: 19.99 },
  { id: 3, name: 'Cloud Function Starter', price: 99.99 },
];

function ProductsPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Products Listing (Mock Data)</h2>
      {mockProducts.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul style={{ listStyleType: 'disc', paddingLeft: '40px' }}>
          {mockProducts.map((product) => (
            <li key={product.id}>
              {product.name} - ${product.price.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ProductsPage;