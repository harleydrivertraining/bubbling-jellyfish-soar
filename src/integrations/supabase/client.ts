import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "http://supabasekong-jwssw0g4g8ggs8gg0sk08kco.65.108.88.56.sslip.io/";
const supabaseAnonKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDE5ODA2MCwiZXhwIjo0OTE5ODcxNjYwLCJyb2xlIjoiYW5vbiJ9.tyeJijSZV4irWOKkXrcZtilv4e-p1ptwkzqOHVEVNyM";

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required. Please set it in your environment variables.');
}
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Please set it in your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);