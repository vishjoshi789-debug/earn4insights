#!/usr/bin/env node
/**
 * Migrate products from data/products.json to database
 * 
 * Usage: node -r dotenv/config migrate-products.mjs
 * Or set DATABASE_URL environment variable before running
 */

import { readFile } from 'fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('\nRun with: node -r dotenv/config migrate-products.mjs');
  console.error('Or: set DATABASE_URL=your-connection-string\n');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function migrateProducts() {
  console.log('🚀 Migrating products to database...\n');

  try {
    // Read products from JSON file
    const data = await readFile('data/products.json', 'utf-8');
    const products = JSON.parse(data);

    console.log(`Found ${products.length} products to migrate\n`);

    let inserted = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        // Check if product already exists
        const existing = await sql`
          SELECT id FROM products WHERE id = ${product.id}
        `;

        if (existing.length > 0) {
          console.log(`⏭️  Skipping ${product.name} (already exists)`);
          skipped++;
          continue;
        }

        // Insert product
        await sql`
          INSERT INTO products (
            id,
            name,
            description,
            platform,
            created_at,
            nps_enabled,
            feedback_enabled,
            social_listening_enabled,
            profile
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

        console.log(`✅ Migrated: ${product.name}`);
        inserted++;

      } catch (err) {
        console.error(`❌ Failed to migrate ${product.name}:`, err.message);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${products.length}\n`);

    // Verify migration
    const count = await sql`SELECT COUNT(*) as count FROM products`;
    console.log(`✅ Database now has ${count[0].count} products\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateProducts();
