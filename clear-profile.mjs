import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function clearProfile() {
  const result = await sql`
    UPDATE user_profiles 
    SET demographics = NULL, interests = NULL 
    WHERE email = 'vishjoshi789@gmail.com'
    RETURNING email, demographics, interests
  `;
  
  console.log('Profile cleared:', result);
}

clearProfile().catch(console.error);
