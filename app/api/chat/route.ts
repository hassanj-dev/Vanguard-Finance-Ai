import { streamText, convertToModelMessages } from 'ai';
import { google } from '@ai-sdk/google';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: google('gemini-3.6-flash'),
      messages: await convertToModelMessages(messages),
      system:
        'You are AI Buddy Your name is Echo, a friendly assistant inside a personal finance & wellness dashboard. ' +
        'You can help with weight tracking advice, budgeting, subscriptions, and daily tasks. ' +
        'Formatting rules (always follow): keep replies SHORT and SCANNABLE, like a clean ChatGPT ' +
        'answer — never one long paragraph. Use markdown: short bold lead-ins, bullet points or a ' +
        'numbered list for steps/options, and at most 1-2 sentences per bullet. Prefer 3-5 bullets ' +
        'over prose. Skip disclaimers and filler ("I would love to help you..."); get straight to ' +
        'the useful content. Only go longer if the user explicitly asks for detail.',
    });

    // IMPORTANT: useChat (from @ai-sdk/react, v5) expects the UI Message
    // Stream protocol, not a plain text stream. toTextStreamResponse()
    // was the bug — the client couldn't parse it, so nothing ever rendered.
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}