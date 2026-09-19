// Thin wrapper around Meta's WhatsApp Cloud API.
//
// Bump WHATSAPP_API_VERSION when Meta deprecates the current one — check
// developers.facebook.com/docs/graph-api/changelog for the current version.
const WHATSAPP_API_VERSION = 'v26.0';
const PHONE_NUMBER_ID = (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim();
const ACCESS_TOKEN = (process.env.WHATSAPP_ACCESS_TOKEN ?? '').trim();

const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

async function callWhatsApp(body: Record<string, unknown>): Promise<boolean> {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('WhatsApp env vars missing: WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN');
    return false;
  }
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('WhatsApp send failed:', res.status, await res.text());
  }

  return res.ok;
}

/**
 * Free-form text reply.
 *
 * Only deliverable inside the 24-hour "customer service window" — i.e. as a
 * reply to something the user messaged you recently. This is what you use
 * to reply to "weight 72" etc. It will silently fail to deliver if the user
 * hasn't messaged you in the last 24 hours.
 */
export async function sendWhatsAppText(to: string, body: string) {
  return callWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

/**
 * Template message.
 *
 * Required for anything YOU initiate outside the 24h window — a subscription
 * or budget alert the user didn't just ask for. The template must first be
 * created and approved in Meta Business Manager → WhatsApp Manager →
 * Message templates (approval usually takes minutes to a few hours).
 *
 * Example template body (create this one first, name it "budget_alert"):
 *   "Heads up — you've used {{1}}% of your ${{2}} monthly budget."
 * Then call: sendWhatsAppTemplate(to, 'budget_alert', 'en_US', ['92', '20000'])
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en_US',
  bodyParams: string[] = []
) {
  return callWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParams.length
        ? {
            components: [
              { type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) },
            ],
          }
        : {}),
    },
  });
}