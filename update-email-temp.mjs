import { neon } from '@neondatabase/serverless'
import 'dotenv/config'

const sql = neon(process.env.POSTGRES_URL)

try {
  const result = await sql`
    UPDATE users 
    SET email = ${'vishjoshi789@gmail.com'} 
    WHERE email = ${'vishweshwar@startupsgurukul.com'} 
    RETURNING id, email, name
  `
  console.log('Updated rows:', result.length)
  if (result.length > 0) {
    console.log('SUCCESS:', JSON.stringify(result[0]))
  } else {
    console.log('No user found with that email')
  }
} catch (e) {
  console.error('ERROR:', e.message)
}
