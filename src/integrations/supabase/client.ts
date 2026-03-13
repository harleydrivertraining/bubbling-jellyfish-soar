import { createClient } from '@supabase/supabase-js';

// These variables are injected by the "Add Supabase" integration.
// If you see an error regarding these, please ensure you have clicked the "Add Supabase" button 
// and entered your project details, then click "Rebuild".
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please use the "Add Supabase" integration button to connect your database.');
}

// We provide fallback strings to prevent the client from throwing an error on initialization,
// allowing the UI to at least render.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-anon-key'
);