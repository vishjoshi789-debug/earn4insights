import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkProfile() {
  const result = await sql`
    SELECT email, demographics, interests 
    FROM user_profiles 
    WHERE email = 'vishjoshi789@gmail.com'
  `;
  
  console.log('Current profile state:');
  console.log(JSON.stringify(result, null, 2));
}

checkProfile().catch(console.error);
