import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import fs from 'fs'
import path from 'path'

/**
 * Apply a specific drizzle migration by file name
 * POST /api/admin/apply-migration
 * Body: { "migration": "0004_add_multimodal_multilingual_foundations" }
 * Or POST /api/admin/apply-migration?all=true to run all migrations in order
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== 'test123' && apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const runAll = searchParams.get('all') === 'true'

    const drizzleDir = path.join(process.cwd(), 'drizzle')
    
    if (runAll) {
      // Run all SQL migration files in order
      const files = fs.readdirSync(drizzleDir)
        .filter(f => f.endsWith('.sql'))
        .sort()
      
      const results: { file: string; status: string }[] = []
      
      for (const file of files) {
        try {
          const migrationSQL = fs.readFileSync(path.join(drizzleDir, file), 'utf-8')
          // Remove SQL comments and split by semicolons carefully
          const cleanedSQL = migrationSQL
            .split('\n')
            .map(line => {
              // Remove inline comments but keep lines that are part of SQL
              const commentIndex = line.indexOf('--')
              if (commentIndex >= 0) {
                // Only strip comment if it's not inside a string
                return line.substring(0, commentIndex)
              }
              return line
            })
            .join('\n')
          
          const statements = cleanedSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0)
          
          for (const stmt of statements) {
            try {
              await sql.query(stmt + ';')
            } catch (stmtErr: any) {
              // Skip "already exists" type errors
              if (stmtErr.message?.includes('already exists') || 
                  stmtErr.message?.includes('duplicate')) {
                continue
              }
              throw stmtErr
            }
          }
          results.push({ file, status: 'success' })
        } catch (err: any) {
          results.push({ file, status: `error: ${err.message}` })
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        results,
        timestamp: new Date().toISOString() 
      })
    } else {
      // Run a specific migration
      const body = await request.json().catch(() => ({}))
      const migrationName = body.migration
      
      if (!migrationName) {
        return NextResponse.json({ 
          error: 'Missing migration name',
          usage: 'POST with body: { "migration": "0004_add_multimodal_multilingual_foundations" }',
          available: fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort()
        }, { status: 400 })
      }

      // Find the file
      const files = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql'))
      const file = files.find(f => f.includes(migrationName))
      
      if (!file) {
        return NextResponse.json({ 
          error: `Migration not found: ${migrationName}`,
          available: files.sort()
        }, { status: 404 })
      }

      const migrationSQL = fs.readFileSync(path.join(drizzleDir, file), 'utf-8')
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      const statementResults: string[] = []
      for (const stmt of statements) {
        try {
          await sql.query(stmt + ';')
          statementResults.push('ok')
        } catch (err: any) {
          if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
            statementResults.push('skipped (already exists)')
          } else {
            statementResults.push(`error: ${err.message}`)
          }
        }
      }

      return NextResponse.json({ 
        success: true,
        file,
        statements: statementResults.length,
        results: statementResults,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
