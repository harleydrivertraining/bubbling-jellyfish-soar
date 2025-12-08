import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "http://supabasekong-h8kskggsc0swkscswgsksgg8.46.62.255.246.sslip.io";
const supabaseAnonKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTE0ODgyMCwiZXhwIjo0OTIwODIyNDIwLCJyb2xlIjoiYW5vbiJ9.mGy4bBG2FGLwzq_p0JAzOUq5vIDlrFYwmmvVtU-msfI";

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required. Please set it in your environment variables.');
}
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Please set it in your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);