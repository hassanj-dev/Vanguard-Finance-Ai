import { supabaseAdmin } from './supabaseAdmin';

// ─────────────────────────────────────────────────────────────────────────
// Single-user assumption: your dashboard has one owner (you). Rather than
// building a phone-number → user_id lookup table, every write just uses
// OWNER_USER_ID from env, and we only act on messages that come from
// OWNER_WHATSAPP_NUMBER. If you ever add other people, swap this block for
// a `profiles` table lookup keyed by `wa_id` instead.
//
// .trim() / .replace(/\D/g, '') here guard against copy-paste noise in the
// env vars (trailing spaces, stray '+' or dashes in the phone number) —
// without this, a perfectly correct-looking value can silently fail to
// match and every message gets the "not linked" reply.
// ─────────────────────────────────────────────────────────────────────────
const OWNER_USER_ID = (process.env.OWNER_USER_ID ?? '').trim();
const OWNER_WHATSAPP_NUMBER = (process.env.OWNER_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

const HELP_TEXT = `Commands:
• weight 72.5 — log a weight
• task buy milk — add a one-off task
• task daily stretch — add a daily task
• task weekly clean car — add a weekly task
• done buy milk — mark a task complete
• sub netflix 15 — add/update a subscription (renewal date defaults to today if new)
• sub netflix 15 2026-10-05 — same, plus set its renewal date (get a WhatsApp alert 3 days before)
• renew netflix 2026-11-05 — update just the renewal date
• income 20000 — set monthly income
• budget housing 500 — set a budget category (housing/food/transport/utilities/other)
• status — quick summary`;

export async function handleIncomingMessage(fromNumber: string, rawText: string): Promise<string> {
  if (fromNumber.replace(/\D/g, '') !== OWNER_WHATSAPP_NUMBER) {
    // Not you — don't touch the database, don't reveal anything about it.
    return "This number isn't linked to any account.";
  }

  const text = rawText.trim();
  const lower = text.toLowerCase();

  try {
    // ── weight 72.5 ──────────────────────────────────────────────────
    let m = lower.match(/^weight\s+(\d+(\.\d+)?)$/);
    if (m) {
      const weight = parseFloat(m[1]);
      const { error } = await supabaseAdmin
        .from('weight_logs')
        .insert({ user_id: OWNER_USER_ID, weight });
      if (error) throw error;
      return `Logged: ${weight} kg ✅`;
    }

    // ── task daily|weekly <text>  /  task <text> ────────────────────
    m = text.match(/^task\s+(daily|weekly)\s+(.+)$/i);
    if (m) {
      const recurrence = m[1].toLowerCase();
      const task = m[2].trim();
      const { error } = await supabaseAdmin
        .from('todos')
        .insert({ user_id: OWNER_USER_ID, task, recurrence, is_completed: false });
      if (error) throw error;
      return `Added ${recurrence} task: "${task}" ✅`;
    }
    m = text.match(/^task\s+(.+)$/i);
    if (m) {
      const task = m[1].trim();
      const { error } = await supabaseAdmin
        .from('todos')
        .insert({ user_id: OWNER_USER_ID, task, recurrence: 'none', is_completed: false });
      if (error) throw error;
      return `Added task: "${task}" ✅`;
    }

    // ── done <text> — fuzzy-match an open task and complete it ──────
    m = text.match(/^done\s+(.+)$/i);
    if (m) {
      const search = m[1].trim();
      const { data: matches, error: findError } = await supabaseAdmin
        .from('todos')
        .select('id, task')
        .eq('user_id', OWNER_USER_ID)
        .eq('is_completed', false)
        .ilike('task', `%${search}%`)
        .limit(1);
      if (findError) throw findError;
      if (!matches || matches.length === 0) {
        return `Couldn't find an open task matching "${search}".`;
      }
      const { error: updateError } = await supabaseAdmin
        .from('todos')
        .update({ is_completed: true, last_completed_at: new Date().toISOString() })
        .eq('id', matches[0].id);
      if (updateError) throw updateError;
      return `Marked "${matches[0].task}" done ✅`;
    }

    // ── renew netflix 2026-11-05 — update just the renewal date ────
    m = text.match(/^renew\s+(.+?)\s+(\d{4}-\d{2}-\d{2})$/i);
    if (m) {
      const name = m[1].trim();
      const renewalDate = m[2];
      const { data: existing, error: findError } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', OWNER_USER_ID)
        .ilike('name', name)
        .limit(1);
      if (findError) throw findError;
      if (!existing || existing.length === 0) {
        return `No subscription named "${name}" found. Add it first: sub ${name} <cost>`;
      }
      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({ renewal_date: renewalDate })
        .eq('id', existing[0].id);
      if (error) throw error;
      return `${name} renewal date set to ${renewalDate} ✅`;
    }

    // ── sub netflix 15  [YYYY-MM-DD]  (insert, or update if it exists) ──
    m = text.match(/^sub(?:scription)?\s+(.+?)\s+(\d+(\.\d+)?)(?:\s+(\d{4}-\d{2}-\d{2}))?$/i);
    if (m) {
      const name = m[1].trim();
      const cost = parseFloat(m[2]);
      const explicitDate = m[4] ?? null;

      const { data: existing, error: findError } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', OWNER_USER_ID)
        .ilike('name', name)
        .limit(1);
      if (findError) throw findError;

      if (existing && existing.length > 0) {
        // Updating an existing subscription: only touch renewal_date if a
        // date was actually given in the message — don't silently wipe out
        // a date you set earlier just because you texted a cost update.
        const updatePayload: Record<string, unknown> = { cost };
        if (explicitDate) updatePayload.renewal_date = explicitDate;
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update(updatePayload)
          .eq('id', existing[0].id);
        if (error) throw error;
        const dateNote = explicitDate ? `, renews ${explicitDate}` : '';
        return `Updated ${name}: $${cost}/mo${dateNote} ✅`;
      }

      // New subscription: match the same default your Subscriptions page
      // uses — if no date was given, default to today. (This does mean it's
      // immediately inside the alert window; use "sub name cost date" to
      // set a real future date and skip that.)
      const renewalDate = explicitDate ?? new Date().toISOString().split('T')[0];
      const { error } = await supabaseAdmin.from('subscriptions').insert({
        user_id: OWNER_USER_ID,
        name,
        cost,
        renewal_date: renewalDate,
      });
      if (error) throw error;
      return `Added subscription: ${name} — $${cost}/mo, renews ${renewalDate} ✅`;
    }

    // ── income 20000 ─────────────────────────────────────────────────
    m = lower.match(/^income\s+(\d+(\.\d+)?)$/);
    if (m) {
      const income = parseFloat(m[1]);
      const { error } = await supabaseAdmin
        .from('budgets')
        .upsert({ user_id: OWNER_USER_ID, income }, { onConflict: 'user_id' });
      if (error) throw error;
      return `Monthly income set to $${income} ✅`;
    }

    // ── budget <category> <amount> ──────────────────────────────────
    m = lower.match(/^budget\s+(housing|food|transport|utilities|other)\s+(\d+(\.\d+)?)$/);
    if (m) {
      const category = m[1];
      const amount = parseFloat(m[2]);
      const { error } = await supabaseAdmin
        .from('budgets')
        .upsert({ user_id: OWNER_USER_ID, [category]: amount }, { onConflict: 'user_id' });
      if (error) throw error;
      return `${category} budget set to $${amount} ✅`;
    }

    // ── status ───────────────────────────────────────────────────────
    if (lower === 'status' || lower === 'summary') {
      return await buildStatusSummary();
    }

    // ── help / anything unrecognised ────────────────────────────────
    return HELP_TEXT;
  } catch (err) {
    console.error('whatsapp command error:', err);
    return "Something went wrong saving that — try again in a bit.";
  }
}

async function buildStatusSummary(): Promise<string> {
  const [{ data: weights }, { data: todos }, { data: subs }, { data: budget }] = await Promise.all([
    supabaseAdmin
      .from('weight_logs')
      .select('weight, created_at')
      .eq('user_id', OWNER_USER_ID)
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseAdmin.from('todos').select('is_completed').eq('user_id', OWNER_USER_ID),
    supabaseAdmin.from('subscriptions').select('cost').eq('user_id', OWNER_USER_ID),
    supabaseAdmin.from('budgets').select('*').eq('user_id', OWNER_USER_ID).maybeSingle(),
  ]);

  const latestWeight = weights && weights.length > 0 ? weights[0].weight : null;
  const pending = (todos ?? []).filter((t) => !t.is_completed).length;
  const subTotal = (subs ?? []).reduce((sum, s) => sum + Number(s.cost || 0), 0);
  const income = Number(budget?.income) || 0;
  const manualExpenses =
    Number(budget?.housing || 0) +
    Number(budget?.food || 0) +
    Number(budget?.transport || 0) +
    Number(budget?.utilities || 0) +
    Number(budget?.other || 0);
  const totalExpenses = manualExpenses + subTotal;
  const usagePercent = income > 0 ? Math.min(Math.round((totalExpenses / income) * 100), 999) : 0;

  return [
    latestWeight !== null ? `Weight: ${latestWeight} kg` : 'Weight: no entries yet',
    `Tasks pending: ${pending}`,
    `Subscriptions: $${subTotal}/mo`,
    income > 0 ? `Budget used: ${usagePercent}% ($${totalExpenses}/$${income})` : 'Budget: income not set',
  ].join('\n');
}