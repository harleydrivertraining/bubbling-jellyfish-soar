import { createClient } from '@supabase/supabase-js';

// These variables are injected by the "Add Supabase" integration.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please use the "Add Supabase" integration button to connect your database.');
}

// We provide fallback strings to prevent the client from throwing an error on initialization.
// Explicitly setting auth options to ensure persistence is active.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true, // Ensures the session is saved to localStorage
      autoRefreshToken: true, // Automatically refreshes the token before it expires
      detectSessionInUrl: true // Necessary for password reset links and OAuth
    }
  }
);