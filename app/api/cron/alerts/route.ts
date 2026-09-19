import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sendWhatsAppTemplate } from '../../../../lib/whatsapp';

const OWNER_USER_ID = process.env.OWNER_USER_ID!;
const OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER!;
const BUDGET_ALERT_THRESHOLD = 90; // percent

// ─────────────────────────────────────────────────────────────────────────
// This is a PROACTIVE message — you're starting the conversation, not
// replying to one. WhatsApp requires an approved message TEMPLATE for that
// (free-form text only works as a reply within 24h of the user's last
// message). Create a template first:
//
//   Meta Business Manager → WhatsApp Manager → Message templates → New
//   Category: Utility
//   Name: budget_alert
//   Body: "Heads up — you've used {{1}}% of your ${{2}} monthly budget."
//
// Wait for approval (usually fast), then this route can use it.
//
// vercel.json wires this to run once a day (Hobby plan minimum interval):
//   { "crons": [{ "path": "/api/cron/alerts", "schedule": "0 8 * * *" }] }
// ─────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on
  // scheduled invocations when CRON_SECRET is set as an env var — this
  // stops anyone else from hitting the URL to trigger alerts on demand.
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data: budget } = await supabaseAdmin
    .from('budgets')
    .select('*')
    .eq('user_id', OWNER_USER_ID)
    .maybeSingle();

  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('cost')
    .eq('user_id', OWNER_USER_ID);

  const income = Number(budget?.income) || 0;
  if (income <= 0) {
    return NextResponse.json({ skipped: 'no income set' });
  }

  const subTotal = (subs ?? []).reduce((sum, s) => sum + Number(s.cost || 0), 0);
  const manualExpenses =
    Number(budget?.housing || 0) +
    Number(budget?.food || 0) +
    Number(budget?.transport || 0) +
    Number(budget?.utilities || 0) +
    Number(budget?.other || 0);
  const totalExpenses = manualExpenses + subTotal;
  const usagePercent = Math.round((totalExpenses / income) * 100);

  if (usagePercent < BUDGET_ALERT_THRESHOLD) {
    return NextResponse.json({ skipped: 'under threshold', usagePercent });
  }

  // Don't send the same alert twice in one day.
  const today = new Date().toISOString().slice(0, 10);
  const alertKey = `budget_${today}`;

  const { data: alreadySent } = await supabaseAdmin
    .from('whatsapp_alerts_log')
    .select('id')
    .eq('alert_key', alertKey)
    .maybeSingle();

  if (alreadySent) {
    return NextResponse.json({ skipped: 'already sent today' });
  }

  const sent = await sendWhatsAppTemplate(OWNER_WHATSAPP_NUMBER, 'budget_alert', 'en_US', [
    String(usagePercent),
    String(income),
  ]);

  if (sent) {
    await supabaseAdmin.from('whatsapp_alerts_log').insert({ alert_key: alertKey });
  }

  return NextResponse.json({ sent, usagePercent });
}