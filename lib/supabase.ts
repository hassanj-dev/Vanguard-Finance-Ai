import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL ya Key missing hai .env.local file mein');
}

// Session ab cookies mein store hoga (localStorage ki jagah), taake
// middleware aur server components bhi usse read kar sakein.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);