import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ensure environment variables are defined
if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is not defined. Please set it in your .env file.");
}
if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is not defined. Please set it in your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);