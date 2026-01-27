import { neon } from '@neondatabase/serverless';

export async function GET(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Get all products with categories
    const products = await sql`
      SELECT id, name, profile
      FROM products
      WHERE profile->>'data'->>'category' IS NOT NULL
    `;

    if (products.length === 0) {
      return Response.json({ error: 'No products found' }, { status: 404 });
    }

    // Group by category
    const categories = new Map<string, any[]>();
    
    products.forEach(product => {
      const profile = product.profile as any;
      const category = profile?.data?.category;
      
      if (category) {
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        
        categories.get(category)!.push({
          id: product.id,
          name: product.name,
          score: Math.random() * 100, // Random score for demo
          rank: 0, // Will be set below
        });
      }
    });

    // Generate rankings for each category
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    let inserted = 0;

    for (const [category, prods] of categories.entries()) {
      // Sort by score and assign ranks
      prods.sort((a, b) => b.score - a.score);
      prods.forEach((p, i) => p.rank = i + 1);

      // Check if ranking already exists for this week/category
      const existing = await sql`
        SELECT id FROM weekly_rankings
        WHERE category = ${category}
        AND week_start = ${weekStart.toISOString()}
      `;

      if (existing.length > 0) {
        continue; // Skip if already exists
      }

      // Insert weekly ranking
      await sql`
        INSERT INTO weekly_rankings (
          id, week_start, week_end, category, category_name, products, created_at
        ) VALUES (
          ${`rank_${category}_${Date.now()}`},
          ${weekStart.toISOString()},
          ${weekEnd.toISOString()},
          ${category},
          ${category},
          ${JSON.stringify(prods)},
          NOW()
        )
      `;

      inserted++;
    }

    return Response.json({
      success: true,
      inserted,
      categories: Array.from(categories.keys()),
      totalProducts: products.length,
    });

  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
