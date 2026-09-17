export type IntentResult =
  | { intent: "ADD_TODO"; task: string }
  | { intent: "LOG_WEIGHT"; weight: number }
  | { intent: "ADD_SUBSCRIPTION"; name: string; cost: number }
  | { intent: "UNKNOWN"; rawText: string };

export function parseWhatsAppMessage(text: string): IntentResult {
  const lower = text.toLowerCase().trim();

  // 1. Weight Logging (Keywords: weight, wgt, kg OR pure number like 75 or 72.5)
  const weightMatch =
    lower.match(/(?:weight|wgt)\s*[:=]?\s*(\d+(?:\.\d+)?)/i) ||
    lower.match(/(\d+(?:\.\d+)?)\s*kg/i) ||
    lower.match(/^(\d+(?:\.\d+)?)$/); // Pure number regex (e.g. "75")

  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    // Safety check: Human weight generally lies between 30kg and 250kg
    if (val >= 30 && val <= 250) {
      return {
        intent: "LOG_WEIGHT",
        weight: val,
      };
    }
  }

  // 2. Subscription Logging (e.g. "bought netflix 1500", "sub spotify 300")
  if (lower.includes("sub") || lower.includes("bought")) {
    const subMatch = lower.match(/(?:bought|sub)\s+([a-zA-Z0-9\s]+?)\s+(\d+)/i);
    if (subMatch) {
      return {
        intent: "ADD_SUBSCRIPTION",
        name: subMatch[1].trim(),
        cost: parseInt(subMatch[2], 10),
      };
    }
  }

  // 3. To-Do Item (e.g. "todo buy groceries", "task submit report")
  if (lower.startsWith("todo") || lower.startsWith("task")) {
    const task = text.replace(/^(todo|task)\s*/i, "").trim();
    return { intent: "ADD_TODO", task };
  }

  return { intent: "UNKNOWN", rawText: text };
}