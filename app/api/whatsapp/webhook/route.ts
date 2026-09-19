import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleIncomingMessage } from '../../../../lib/whatsappCommands';
import { sendWhatsAppText } from '../../../../lib/whatsapp';

// ─────────────────────────────────────────────────────────────────────────
// GET — Meta's one-time webhook verification handshake.
// When you paste your webhook URL + verify token into the Meta dashboard,
// Meta sends this GET request. You must echo back hub.challenge, but only
// if hub.verify_token matches the token YOU chose (set it as an env var
// and paste the same string into the Meta dashboard field).
// ─────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// ─────────────────────────────────────────────────────────────────────────
// POST — actual incoming messages land here.
// Meta signs every POST body with your app secret. Verifying that
// signature stops anyone else from POSTing fake "weight 999999" payloads
// at your public webhook URL and writing garbage into your database.
// ─────────────────────────────────────────────────────────────────────────
function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // signature check skipped if you haven't set this yet
  if (!signatureHeader) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // constant-time comparison — avoids timing attacks
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Payload shape: entry[] -> changes[] -> value.messages[]
  // Always an array — a batch can carry more than one message.
  const entries = payload.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];

      for (const message of messages) {
        // Only handling plain text for now. Other types (image, audio,
        // location...) show up here too with message.type set accordingly.
        if (message.type !== 'text') continue;

        const from = message.from as string; // sender's WhatsApp number, digits only
        const text = message.text?.body ?? '';

        const reply = await handleIncomingMessage(from, text);
        await sendWhatsAppText(from, reply);
      }
    }
  }

  // Meta requires a fast 200 OK — it retries with backoff if it doesn't get
  // one, which can end up re-delivering the same message several times.
  return NextResponse.json({ ok: true });
}