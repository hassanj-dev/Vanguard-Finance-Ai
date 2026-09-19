import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client.
 *
 * Your existing `lib/supabase.ts` client uses the ANON key and relies on the
 * logged-in user's session for RLS. A WhatsApp message has no session — it
 * just has a phone number — so this client uses the SERVICE ROLE key, which
 * bypasses RLS entirely.
 *
 * NEVER import this file from a 'use client' component. NEVER prefix the
 * service role key with NEXT_PUBLIC_. It must only be read on the server
 * (API routes, route handlers, cron jobs).
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);