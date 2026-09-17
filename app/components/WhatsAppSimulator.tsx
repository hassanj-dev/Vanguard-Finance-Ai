"use client";

import { useState } from "react";
import { parseWhatsAppMessage, IntentResult } from "@/lib/aiParser";

interface WhatsAppSimulatorProps {
  onMessageParsed?: (result: IntentResult) => void;
}

export default function WhatsAppSimulator({ onMessageParsed }: WhatsAppSimulatorProps) {
  const [input, setInput] = useState("");
  const [lastParsed, setLastParsed] = useState<IntentResult | null>(null);

  const handleSimulate = () => {
    if (!input.trim()) return;

    const result = parseWhatsAppMessage(input);
    setLastParsed(result);

    if (onMessageParsed) {
      onMessageParsed(result);
    }

    setInput("");
  };

  return (
    <div className="border p-4 rounded-xl bg-slate-900 text-white shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-emerald-400">
          💬 WhatsApp Message Simulator
        </h2>
        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
          Testing Mode
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. '75', 'todo buy milk', or 'bought Netflix 1500'"
          className="border border-slate-700 bg-slate-800 p-2 rounded-lg flex-1 text-white text-sm"
        />
        <button
          onClick={handleSimulate}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Send
        </button>
      </div>

      {lastParsed && (
        <div className="bg-slate-800 p-3 rounded-lg text-xs space-y-1 font-mono border border-slate-700">
          <p className="text-slate-400">Parsed Output:</p>
          <pre className="text-emerald-300 overflow-x-auto">
            {JSON.stringify(lastParsed, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}