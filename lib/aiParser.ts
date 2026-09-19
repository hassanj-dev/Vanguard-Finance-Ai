export type IntentResult =
  | { intent: 'ADD_TODO'; task: string }
  | { intent: 'LOG_WEIGHT'; weight: number }
  | { intent: 'ADD_SUBSCRIPTION'; name: string; cost: number }
  | { intent: 'UNKNOWN'; rawText: string };

/**
 * FIXED (logic bug): the old version ran the weight check FIRST, before the
 * explicit "todo"/"task" prefixes. Any task containing a number followed by
 * "kg" was stolen by the weight branch:
 *
 *   "todo buy 5 kg rice"   → LOG_WEIGHT 5   ❌  (and silently dropped, since
 *                                                5 is outside the 30–250 range)
 *   "task weight the bags" → fell through   ❌
 *
 * Explicit prefixes now win, and the bare-number weight fallback only
 * applies when the message is nothing but a number.
 *
 * Also fixed: the subscription name was taken from the lowercased string, so
 * "Netflix" was always stored as "netflix". It now slices the ORIGINAL text.
 */
export function parseWhatsAppMessage(text: string): IntentResult {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // ── 1. Explicit to-do prefix — highest priority ──────────────────────
  const todoMatch = raw.match(/^(?:todo|task)\b[\s:.-]*/i);
  if (todoMatch) {
    const task = raw.slice(todoMatch[0].length).trim();
    if (task) return { intent: 'ADD_TODO', task };
  }

  // ── 2. Explicit subscription prefix ──────────────────────────────────
  //    "sub netflix 1500", "bought spotify 300"
  const subMatch = raw.match(/^(?:sub|subscription|bought)\b[\s:.-]*(.+?)\s+(\d+(?:\.\d+)?)\s*$/i);
  if (subMatch) {
    const name = subMatch[1].trim();
    const cost = parseFloat(subMatch[2]);
    if (name && !Number.isNaN(cost) && cost > 0) {
      return { intent: 'ADD_SUBSCRIPTION', name, cost };
    }
  }

  // ── 3. Weight ────────────────────────────────────────────────────────
  const weightMatch =
    lower.match(/(?:weight|wgt)\s*[:=]?\s*(\d+(?:\.\d+)?)/i) ||
    lower.match(/^(\d+(?:\.\d+)?)\s*kgs?$/i) || // "72.5 kg" and nothing else
    lower.match(/^(\d+(?:\.\d+)?)$/); // pure number, e.g. "75"

  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    // Human weight sanity range.
    if (val >= 30 && val <= 250) {
      return { intent: 'LOG_WEIGHT', weight: val };
    }
  }

  return { intent: 'UNKNOWN', rawText: raw };
}