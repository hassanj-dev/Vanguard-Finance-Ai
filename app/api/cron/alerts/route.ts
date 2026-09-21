import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { sendWhatsAppTemplate } from '../../../../lib/whatsapp';

// Same normalization as lib/whatsappCommands.ts — guards against trailing
// whitespace or stray characters in the env vars.
const OWNER_USER_ID = (process.env.OWNER_USER_ID ?? '').trim();
const OWNER_WHATSAPP_NUMBER = (process.env.OWNER_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

const BUDGET_ALERT_THRESHOLD = 90; // percent
const RENEWAL_ALERT_WINDOW_DAYS = 3; // alert this many days before renewal

// ─────────────────────────────────────────────────────────────────────────
// This is a PROACTIVE message — you're starting the conversation, not
// replying to one. WhatsApp requires an approved message TEMPLATE for that
// (free-form text only works as a reply within 24h of the user's last
// message). Create TWO templates first:
//
//   Meta Business Manager → WhatsApp Manager → Message templates → New
//
//   1) Name: budget_alert   Category: Utility
//      Body: "Heads up — you've used {{1}}% of your ${{2}} monthly budget."
//
//   2) Name: subscription_renewal_alert   Category: Utility
//      Body: "Your {{1}} subscription (${{2}}/mo) renews on {{3}}."
//
// Wait for approval (usually fast), then this route can use them.
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

  const results = await Promise.all([checkBudgetAlert(), checkSubscriptionRenewals()]);

  return NextResponse.json({ budget: results[0], subscriptions: results[1] });
}

async function alreadySent(alertKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('whatsapp_alerts_log')
    .select('id')
    .eq('alert_key', alertKey)
    .maybeSingle();
  return !!data;
}

async function markSent(alertKey: string) {
  await supabaseAdmin.from('whatsapp_alerts_log').insert({ alert_key: alertKey });
}

async function checkBudgetAlert() {
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
  if (income <= 0) return { skipped: 'no income set' };

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
    return { skipped: 'under threshold', usagePercent };
  }

  // One alert per day, not one per percentage point.
  const today = new Date().toISOString().slice(0, 10);
  const alertKey = `budget_${today}`;

  if (await alreadySent(alertKey)) {
    return { skipped: 'already sent today' };
  }

  const sent = await sendWhatsAppTemplate(OWNER_WHATSAPP_NUMBER, 'budget_alert', 'en_US', [
    String(usagePercent),
    String(income),
  ]);

  if (sent) await markSent(alertKey);
  return { sent, usagePercent };
}

async function checkSubscriptionRenewals() {
  const { data: subs, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, name, cost, next_renewal_date')
    .eq('user_id', OWNER_USER_ID)
    .not('next_renewal_date', 'is', null);

  if (error || !subs) return { error: error?.message ?? 'query failed' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alertsSent: string[] = [];
  const skipped: string[] = [];

  for (const sub of subs) {
    const renewalDate = new Date(sub.next_renewal_date as string);
    renewalDate.setHours(0, 0, 0, 0);

    const daysUntil = Math.round((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0 || daysUntil > RENEWAL_ALERT_WINDOW_DAYS) {
      continue; // too far away, or date already passed and never updated
    }

    // One alert per subscription per renewal date — once you push the date
    // forward with "renew <name> <date>", a fresh key means a fresh alert.
    const alertKey = `sub_${sub.id}_${sub.next_renewal_date}`;
    if (await alreadySent(alertKey)) {
      skipped.push(sub.name);
      continue;
    }

    const sent = await sendWhatsAppTemplate(
      OWNER_WHATSAPP_NUMBER,
      'subscription_renewal_alert',
      'en_US',
      [sub.name, String(sub.cost), sub.next_renewal_date as string]
    );

    if (sent) {
      await markSent(alertKey);
      alertsSent.push(sub.name);
    }
  }

  return { alertsSent, skipped };
}