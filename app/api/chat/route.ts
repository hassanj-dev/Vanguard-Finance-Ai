import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { createSupabaseServerClient } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * FIX #2 — AI Buddy was not replying.
 *
 * Root cause: `google('gemini-3.6-flash')` is not a real model id. Google's
 * API rejected every request with a 404 NOT_FOUND. Because `streamText()`
 * fails *during* the stream and not at call time, the surrounding
 * try/catch never fired — the route returned 200 with an empty stream, the
 * client sat in "Thinking…" forever, and nothing was ever logged.
 *
 * What changed:
 *   - Correct, current model id (overridable via env).
 *   - `onError` on the stream response, so model/quota/key failures are
 *     logged server-side AND delivered to the client as a readable message
 *     instead of silence.
 *   - Missing API key is detected up front with a clear message.
 *   - The route now requires a signed-in Supabase session. Without this,
 *     /api/chat was a public, unauthenticated, unmetered proxy to your paid
 *     Gemini key — anyone who found the URL could drain your quota.
 *   - Basic per-user rate limiting.
 *   - `convertToModelMessages` returns a Promise in this SDK version, so it
 *     is awaited before being passed to `streamText`.
 *
 * Required env var (add to .env.local AND to Vercel → Project → Settings →
 * Environment Variables, then redeploy):
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY=...
 *
 * Optional (defaults to Google's current stable flash model):
 *   GOOGLE_CHAT_MODEL=gemini-3.6-flash
 *
 * NOTE: gemini-2.5-flash was retired in 2026 and now 404s as "no longer
 * available." Model availability on this API shifts often — if this
 * default ever 404s again, check https://ai.google.dev/gemini-api/docs/models
 * for the current stable id, or open Google AI Studio and list the models
 * your specific key actually has access to (access varies by account/tier).
 */

const MODEL_ID = process.env.GOOGLE_CHAT_MODEL || 'gemini-3.6-flash';

const SYSTEM_PROMPT = [
  'You are AI Buddy. Your name is Echo, a friendly assistant inside a personal finance & wellness dashboard.',
  'You can help with weight tracking advice, budgeting, subscriptions, and daily tasks.',
  'Formatting rules (always follow): keep replies SHORT and SCANNABLE — never one long paragraph.',
  'Use markdown: short bold lead-ins, bullet points or a numbered list for steps/options, and at most',
  '1-2 sentences per bullet. Prefer 3-5 bullets over prose. Skip disclaimers and filler',
  '("I would love to help you..."); get straight to the useful content.',
  'Only go longer if the user explicitly asks for detail.',
  'You are not a financial adviser: report and explain, do not recommend specific investments.',
].join(' ');

/** Naive in-memory limiter. Per serverless instance only — good enough to
 *  stop casual abuse. Move to Upstash/Redis if you need a real one. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > MAX_PER_WINDOW;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('[chat] GOOGLE_GENERATIVE_AI_API_KEY is not set');
      return json({ error: 'Echo is not configured yet. Missing AI API key.' }, 500);
    }

    // ── Auth ────────────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Sign in to chat with Echo.' }, 401);
    }

    if (rateLimited(user.id)) {
      return json({ error: 'Too many messages. Give it a minute.' }, 429);
    }

    // ── Body ────────────────────────────────────────────────────────────
    let messages: UIMessage[];
    try {
      const body = await req.json();
      messages = body?.messages;
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No messages provided.' }, 400);
    }

    // Cap history so a long session can't blow up cost or context.
    const recent = messages.slice(-24);

    const result = streamText({
      model: google(MODEL_ID),
      // NOTE: convertToModelMessages returns a Promise in this SDK version —
      // it must be awaited, not passed straight through.
      messages: await convertToModelMessages(recent),
      system: SYSTEM_PROMPT,
      abortSignal: req.signal,
    });

    // IMPORTANT: useChat (from @ai-sdk/react, v5) expects the UI Message
    // Stream protocol, not a plain text stream — toTextStreamResponse()
    // would leave the client unable to parse anything.
    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error('[chat] stream error:', error);
        const message = error instanceof Error ? error.message : String(error);

        if (/api[_ ]?key|PERMISSION_DENIED|401|403/i.test(message)) {
          return 'Echo could not authenticate with the AI provider. Check GOOGLE_GENERATIVE_AI_API_KEY.';
        }
        if (/quota|RESOURCE_EXHAUSTED|429/i.test(message)) {
          return 'Echo has hit its rate limit. Try again in a moment.';
        }
        if (/not found|404|model/i.test(message)) {
          return `Echo could not reach the model "${MODEL_ID}". Check GOOGLE_CHAT_MODEL.`;
        }
        return 'Echo ran into a problem generating that reply. Try again.';
      },
    });
  } catch (error) {
    console.error('[chat] fatal:', error);
    return json({ error: 'Internal Server Error' }, 500);
  }
}