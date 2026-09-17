import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to send WhatsApp auto-reply
async function sendWhatsAppReply(to: string, text: string) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text },
    }),
  });

  const resData = await response.json();
  if (!response.ok) {
    console.error('WhatsApp API Reply Error:', resData);
  } else {
    console.log('WhatsApp Reply Sent Successfully:', resData);
  }
}

// GET Handler for Meta Webhook Verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// POST Handler for Inbound Messages
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('--- Incoming Webhook Payload ---');
    console.log(JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      console.log('Ignored non-text message or status update');
      return NextResponse.json({ status: 'ignored' });
    }

    const from = message.from; // Sender phone number
    const msgText = message.text.body.trim();
    const lowerText = msgText.toLowerCase();

    console.log(`Received message from ${from}: "${msgText}"`);

    let replyMessage = "Syntax invalid. Example commands:\n- '75' (Weight)\n- 'todo buy milk' (Task)\n- 'netflix 1500' (Subscription)";

    // 1. Log Weight (e.g., "75" or "75.5")
    if (!isNaN(Number(msgText))) {
      const weightVal = parseFloat(msgText);
      const { error } = await supabase.from('weight_logs').insert({ weight: weightVal });
      
      if (!error) {
        replyMessage = `Weight logged successfully: ${weightVal} kg`;
      } else {
        console.error('Supabase Weight Error:', error);
        replyMessage = `Error saving weight: ${error.message}`;
      }
    }
    // 2. Log To-Do Task (e.g., "todo buy groceries")
    else if (lowerText.startsWith('todo ')) {
      const taskName = msgText.slice(5).trim();
      const { error } = await supabase.from('todos').insert({ task: taskName, is_completed: false });

      if (!error) {
        replyMessage = `Task added to-do list: "${taskName}"`;
      } else {
        console.error('Supabase Todo Error:', error);
        replyMessage = `Error adding task: ${error.message}`;
      }
    }
    // 3. Log Subscription (e.g., "netflix 1500")
    else if (lowerText.includes(' ')) {
      const parts = msgText.split(' ');
      const amount = parseFloat(parts[parts.length - 1]);
      const name = parts.slice(0, -1).join(' ');

      if (!isNaN(amount) && name) {
        const { error } = await supabase.from('subscriptions').insert({ name, cost: amount });
        if (!error) {
          replyMessage = `Subscription logged: ${name} (Rs. ${amount})`;
        } else {
          console.error('Supabase Subscription Error:', error);
          replyMessage = `Error saving subscription: ${error.message}`;
        }
      }
    }

    // Send automated WhatsApp confirmation reply
    await sendWhatsAppReply(from, replyMessage);

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (err: any) {
    console.error('Webhook Server Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}