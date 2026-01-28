import { neon } from '@neondatabase/serverless';
import { readFile } from 'fs/promises';

export async function GET(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    // Read products from file
    const data = await readFile('data/products.json', 'utf-8');
    const products = JSON.parse(data);

    let upserted = 0;
    const errors = [];

    for (const product of products) {
      try {
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
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            platform = EXCLUDED.platform,
            created_at = EXCLUDED.created_at,
            nps_enabled = EXCLUDED.nps_enabled,
            feedback_enabled = EXCLUDED.feedback_enabled,
            social_listening_enabled = EXCLUDED.social_listening_enabled,
            profile = EXCLUDED.profile
        `;
        upserted++;
      } catch (err: any) {
        errors.push({ product: product.name, error: err.message });
      }
    }

    // Get total count
    const count = await sql`SELECT COUNT(*) as count FROM products`;

    return Response.json({
      success: true,
      upserted,
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
