// Maps common subscription service names to their domain, so we can pull a
// real logo via Google's public favicon service.
// Matching is case-insensitive and checks if the subscription name *contains*
// any of the keywords below, so "Adobe Photoshop" still matches "adobe".

const SERVICE_DOMAINS: { keywords: string[]; domain: string }[] = [
  { keywords: ["netflix"], domain: "netflix.com" },
  { keywords: ["spotify"], domain: "spotify.com" },
  { keywords: ["prime", "amazon"], domain: "amazon.com" },
  { keywords: ["youtube"], domain: "youtube.com" },
  { keywords: ["disney"], domain: "disneyplus.com" },
  { keywords: ["adobe", "photoshop", "creative cloud", "illustrator", "premiere"], domain: "adobe.com" },
  { keywords: ["canva"], domain: "canva.com" },
  { keywords: ["apple music", "apple tv", "icloud", "apple one"], domain: "apple.com" },
  { keywords: ["hbo", "max"], domain: "max.com" },
  { keywords: ["hulu"], domain: "hulu.com" },
  { keywords: ["playstation", "ps plus", "ps5", "ps4"], domain: "playstation.com" },
  { keywords: ["xbox", "game pass"], domain: "xbox.com" },
  { keywords: ["dropbox"], domain: "dropbox.com" },
  { keywords: ["google one", "google drive", "google storage"], domain: "google.com" },
  { keywords: ["notion"], domain: "notion.so" },
  { keywords: ["slack"], domain: "slack.com" },
  { keywords: ["zoom"], domain: "zoom.us" },
  { keywords: ["github", "copilot"], domain: "github.com" },
  { keywords: ["chatgpt", "openai"], domain: "openai.com" },
  { keywords: ["grammarly"], domain: "grammarly.com" },
  { keywords: ["linkedin"], domain: "linkedin.com" },
  { keywords: ["audible"], domain: "audible.com" },
  { keywords: ["duolingo"], domain: "duolingo.com" },
  { keywords: ["figma"], domain: "figma.com" },
  { keywords: ["claude", "anthropic"], domain: "anthropic.com" },
  { keywords: ["midjourney"], domain: "midjourney.com" },
  { keywords: ["vercel"], domain: "vercel.com" },
  { keywords: ["supabase"], domain: "supabase.com" },
];

/**
 * Returns a logo URL for a known subscription name, or null if we don't
 * recognize the service (caller should fall back to a letter avatar).
 *
 * Uses Google's public favicon service rather than Clearbit's logo API,
 * since Clearbit is also a tracking/enrichment company and its domain is
 * commonly blocked by ad blockers (uBlock Origin, Brave Shield, etc.),
 * which silently breaks the logo and always falls back to the letter.
 * Google's favicon service is the same one Chrome itself uses for
 * bookmarks/tabs, so it's far less likely to be blocked.
 */
export function getSubscriptionLogoUrl(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const match = SERVICE_DOMAINS.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (!match) return null;

  return `https://www.google.com/s2/favicons?sz=128&domain=${match.domain}`;
}