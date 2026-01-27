import { neon } from '@neondatabase/serverless';
import { readFile } from 'fs/promises';

export async function GET(request: Request) {
  // Security: Only allow in development or with secret
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  if (process.env.NODE_ENV === 'production' && secret !== process.env.MIGRATION_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Read products from file
    const data = await readFile('data/products.json', 'utf-8');
    const products = JSON.parse(data);

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const product of products) {
      try {
        // Check if exists
        const existing = await sql`SELECT id FROM products WHERE id = ${product.id}`;
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Insert product
        await sql`
          INSERT INTO products (
            id, name, description, platform, created_at,
            nps_enabled, feedback_enabled, social_listening_enabled, profile
          ) VALUES (
            ${product.id},
            ${product.name},
            ${product.description || null},
            ${product.platform || 'web'},
            ${product.created_at || new Date().toISOString()},
            ${product.features?.nps || false},
            ${product.features?.feedback || false},
            ${product.features?.social_listening || false},
            ${JSON.stringify(product.profile)}
          )
        `;

        inserted++;
      } catch (err: any) {
        errors.push({ product: product.name, error: err.message });
      }
    }

    // Get total count
    const count = await sql`SELECT COUNT(*) as count FROM products`;

    return Response.json({
      success: true,
      inserted,
      skipped,
      errors,
      totalProducts: count[0].count,
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
