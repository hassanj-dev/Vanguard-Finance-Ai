'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Plus,
  Mic,
  Flame,
  Wallet,
  PieChart,
  Target,
  ArrowRight,
  MoreVertical,
  ChevronLeft,
  X,
} from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// =====================================================================
// AI BUDDY MASCOT — mini version of the animated glass orb, used
// anywhere small: launcher pill, header, message avatars, typing dots.
// Same gradient/glass-highlight language as the big welcome-screen hero,
// just scaled down and simplified (no rings/particles at this size).
// The gradient itself stays fixed (indigo/violet) in both themes — it's
// the mascot's "skin", not a surface color, so it isn't tokenized.
// =====================================================================
function AIBuddyOrb({ size = 24, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          className="absolute rounded-full bg-indigo-500/25 blur-md animate-[pulse_4s_ease-in-out_infinite]"
          style={{ width: size * 1.7, height: size * 1.7 }}
        />
      )}
      <span
        className="relative rounded-full bg-gradient-to-b from-indigo-300 via-violet-500 to-indigo-800 shadow-[inset_0_2px_3px_rgba(255,255,255,0.7),inset_0_-4px_8px_rgba(49,46,129,0.5),0_3px_10px_rgba(99,102,241,0.4)]"
        style={{ width: size, height: size }}
      >
        {/* glass highlight */}
        <span
          className="absolute rounded-full bg-white/40 blur-[0.5px]"
          style={{
            width: size * 0.46,
            height: size * 0.2,
            left: '50%',
            top: size * 0.13,
            transform: 'translateX(-50%)',
          }}
        />

        {/* eyes */}
        <span
          className="absolute flex items-center justify-center"
          style={{ left: 0, right: 0, top: size * 0.39, gap: size * 0.11 }}
        >
          <span
            className="rounded-full bg-white"
            style={{ width: size * 0.12, height: size * 0.24 }}
          />
          <span
            className="rounded-full bg-white"
            style={{ width: size * 0.12, height: size * 0.24 }}
          />
        </span>

        {/* mouth */}
        <span
          className="absolute rounded-full bg-white/85"
          style={{
            width: size * 0.24,
            height: size * 0.07,
            left: '50%',
            top: size * 0.72,
            transform: 'translateX(-50%)',
          }}
        />
      </span>
    </span>
  );
}

// =====================================================================
// Markdown renderer for assistant replies
// =====================================================================
function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="leading-relaxed" {...props} />,
          ul: (props) => <ul className="ml-4 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="ml-4 list-decimal space-y-1" {...props} />,
          li: (props) => <li className="pl-0.5 leading-relaxed" {...props} />,
          strong: (props) => <strong className="font-semibold text-inherit" {...props} />,
          h1: (props) => <p className="text-[12px] font-semibold" {...props} />,
          h2: (props) => <p className="text-[12px] font-semibold" {...props} />,
          h3: (props) => <p className="text-[11px] font-semibold" {...props} />,
          code: (props) => (
            <code className="rounded bg-[var(--panel-2)] px-1 py-0.5 text-[10px]" {...props} />
          ),
          a: (props) => (
            <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const SUGGESTIONS = [
  {
    key: 'health',
    icon: Flame,
    tint: 'text-orange-500',
    title: 'Health & Weight',
    subtitle: 'Build a personalized plan',
    prompt: 'My current weight is 78kg. Please give me personalized weight gain advice.',
  },
  {
    key: 'budget',
    icon: Wallet,
    tint: 'text-indigo-500',
    title: 'Save Budget',
    subtitle: "Optimize this month's spend",
    prompt: 'How can I optimize my monthly budget and reduce my subscriptions?',
  },
  {
    key: 'expenses',
    icon: PieChart,
    tint: 'text-sky-500',
    title: 'Expenses',
    subtitle: 'Analyze my spending',
    prompt: 'Take a look at my recent spending and tell me where the money is going.',
  },
  {
    key: 'goals',
    icon: Target,
    tint: 'text-violet-500',
    title: 'Goals',
    subtitle: 'Stay on track',
    prompt: 'Help me set realistic goals and a plan to reach them this month.',
  },
];

export default function AIBuddy() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // FIXED: the SpeechRecognition instance was previously created fresh
  // inside the handler with no reference kept anywhere, so there was no
  // way to stop it — closing the chat window (or unmounting) mid-listen
  // left the browser's mic listener running. It's now kept in a ref and
  // explicitly aborted both on manual stop and on unmount.
  const recognitionRef = useRef<any>(null);

  const { messages, sendMessage, status } = useChat();
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleVoiceRecognition = () => {
    if (isVoiceActive) {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
      setIsVoiceActive(false);
      return;
    }

    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsVoiceActive(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsVoiceActive(false);
    };
    recognition.onerror = () => setIsVoiceActive(false);
    recognition.onend = () => {
      setIsVoiceActive(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleClose = () => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    setIsVoiceActive(false);
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const messageText = input;
    const fileToSend = selectedFile;

    setInput('');
    removeFile();

    if (fileToSend) {
      const fileList = new DataTransfer();
      fileList.items.add(fileToSend);
      await sendMessage({
        text: messageText || 'Analyze this uploaded receipt/image.',
        files: fileList.files,
      });
    } else {
      await sendMessage({ text: messageText });
    }
  };

  // `useChat` from @ai-sdk/react streams messages as `parts` (not a flat
  // `content` string). The `m.content` branch is kept only as a defensive
  // fallback in case an older cached message shape shows up; the `parts`
  // path is what actually runs in normal operation.
  const renderMessageContent = (m: any) => {
    if (Array.isArray(m.parts)) {
      return m.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }
    if (typeof m.content === 'string' && m.content) return m.content;
    return '';
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <style>{`
        .buddy-scroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--accent) 25%, transparent) transparent; }
        .buddy-scroll::-webkit-scrollbar { width: 5px; }
        .buddy-scroll::-webkit-scrollbar-track { background: transparent; }
        .buddy-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 999px; }
        .buddy-scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--accent) 50%, transparent); }

        @keyframes buddyOpen {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .buddy-window { animation: buddyOpen 0.22s cubic-bezier(0.16, 1, 0.3, 1); }

        @keyframes aiFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-8px) scale(1.15); opacity: 0.5; }
        }
      `}</style>


{/* ===================================================
        FLOATING LAUNCHER
    =================================================== */}
    {!isOpen && (
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center justify-center p-2 rounded-full shadow-[var(--shadow)] transition-all duration-200 cursor-pointer"
      >
        <AIBuddyOrb size={42} glow />
      </button>
    )}

      {/* ===================================================
          CHAT WINDOW
      =================================================== */}
      {isOpen && (
        <div
          className="buddy-window flex w-[420px] max-w-[92vw] flex-col rounded-[24px] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow)] overflow-hidden"
          style={{ height: 'min(600px, calc(100vh - 6rem))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-2)] transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <AIBuddyOrb size={26} />
              <div className="flex flex-col leading-tight">
                <span className="text-[12.5px] font-semibold text-[var(--text)]">Echo</span>
                <span className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                  {isLoading ? (
                    <>
                      <span className="h-1 w-1 rounded-full bg-indigo-400 animate-pulse" />
                      Thinking...
                    </>
                  ) : (
                    'Your personal assistant'
                  )}
                </span>
              </div>
            </div>

            <button className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-2)] transition cursor-pointer">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="buddy-scroll flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--panel)] text-xs">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center my-2 text-center">
                {/* Premium animated AI Buddy */}
                <div className="relative flex h-40 w-40 items-center justify-center my-2">
                  {/* Ambient outer glow */}
                  <div className="absolute h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />

                  {/* Rotating soft aura */}
                  <div className="absolute h-36 w-36 rounded-full border border-indigo-300/20 animate-[spin_12s_linear_infinite]" />
                  <div className="absolute h-32 w-32 rounded-full border border-violet-300/10 animate-[spin_8s_linear_infinite_reverse]" />

                  {/* Floating glow particles */}
                  <span className="absolute left-5 top-8 h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_10px_rgba(165,180,252,1)] animate-[floatParticle_3s_ease-in-out_infinite]" />
                  <span className="absolute right-6 top-12 h-1 w-1 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,1)] animate-[floatParticle_4s_ease-in-out_infinite_1s]" />
                  <span className="absolute bottom-8 left-8 h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,1)] animate-[floatParticle_3.5s_ease-in-out_infinite_.5s]" />

                  {/* Main floating AI body */}
                  <div
                    className="
                      relative flex h-28 w-28 items-center justify-center
                      rounded-full
                      bg-gradient-to-br from-indigo-300 via-violet-500 to-indigo-800
                      shadow-[inset_0_3px_8px_rgba(255,255,255,0.7),inset_0_-10px_20px_rgba(49,46,129,0.5),0_15px_45px_rgba(99,102,241,0.45)]
                      animate-[aiFloat_4s_ease-in-out_infinite]
                    "
                  >
                    {/* Glass highlight */}
                    <div className="absolute left-5 top-3 h-7 w-14 rotate-[-20deg] rounded-full bg-white/30 blur-[3px]" />

                    {/* Small top shine */}
                    <div className="absolute left-1/2 top-3 h-2 w-6 -translate-x-1/2 rounded-full bg-white/50 blur-[2px]" />

                    {/* Inner glass aura */}
                    <div className="absolute inset-2 rounded-full border border-white/20" />

                    {/* Face */}
                    <div className="relative flex items-center gap-4">
                      {/* Left eye */}
                      <div className="relative h-7 w-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]">
                        <div className="absolute inset-x-0.5 top-1 h-2 rounded-full bg-indigo-100/80 blur-[1px]" />
                      </div>

                      {/* Right eye */}
                      <div className="relative h-7 w-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]">
                        <div className="absolute inset-x-0.5 top-1 h-2 rounded-full bg-indigo-100/80 blur-[1px]" />
                      </div>
                    </div>

                    {/* Tiny smile / AI expression */}
                    <div className="absolute bottom-7 left-1/2 h-1.5 w-5 -translate-x-1/2 rounded-full bg-white/60 blur-[1px]" />
                  </div>

                  {/* Bottom ambient reflection */}
                  <div className="absolute bottom-1 h-3 w-20 rounded-full bg-indigo-500/25 blur-xl" />
                </div>

                <h2 className="text-[15px] font-semibold text-[var(--text)] px-6 leading-snug">
                  Hi, I&apos;m Echo
                </h2>
                <p className="mt-1 text-[11px] text-[var(--muted)] px-8 leading-relaxed">
                  Ask me anything about your finances, habits, goals, or dashboard.
                </p>

                <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
                  {SUGGESTIONS.map(({ key, icon: Icon, tint, title, subtitle, prompt }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="flex flex-col justify-between p-3 rounded-2xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--line-strong)] hover:-translate-y-0.5 transition-all text-left cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`h-3.5 w-3.5 ${tint}`} strokeWidth={2} />
                        <ArrowRight className="h-3 w-3 text-[var(--muted)] group-hover:translate-x-0.5 group-hover:text-[var(--text)] transition-all" />
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-[var(--text)]">{title}</p>
                        <p className="text-[10px] text-[var(--muted)] font-medium">{subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role !== 'user' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center mt-1">
                    <AIBuddyOrb size={24} />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[82%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[var(--accent)] text-white rounded-br-md shadow-[0_2px_8px_var(--accent-wash)]'
                      : 'bg-[var(--panel-2)] text-[var(--text)] rounded-bl-md'
                  }`}
                >
                  {m.role === 'user' ? (
                    renderMessageContent(m)
                  ) : (
                    <AssistantMarkdown content={renderMessageContent(m)} />
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start items-center">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <AIBuddyOrb size={24} glow />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-[var(--panel-2)] px-3.5 py-2.5 text-[11px] text-[var(--muted)]">
                  Thinking
                  <span className="flex items-center gap-0.5">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.3s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--muted)]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Attachment Preview — compact chip */}
          {filePreview && (
            <div className="px-3.5 pt-2.5 bg-[var(--panel)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-2)] py-1 pl-1 pr-2.5 text-[11px] text-[var(--text)]">
                <img
                  src={filePreview}
                  alt="Attachment preview"
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="truncate max-w-[160px] font-medium">{selectedFile?.name}</span>
                <button
                  type="button"
                  onClick={removeFile}
                  className="rounded-full p-0.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)] transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input — single rounded field, controls tucked inside */}
          <form onSubmit={handleSubmit} className="p-3">
            <div className="flex items-end gap-1.5 rounded-[20px] border border-[var(--line)] bg-[var(--panel-2)] px-2 py-2 focus-within:border-[var(--line-strong)] transition-colors">
              <label
                title="Attach image / receipt"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--accent)] transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isVoiceActive
                    ? 'Listening...'
                    : selectedFile
                    ? 'Add a note...'
                    : 'Type a message...'
                }
                className="flex-1 bg-transparent px-1 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
              />

              <button
                type="button"
                title="Voice mode"
                onClick={toggleVoiceRecognition}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
                  isVoiceActive
                    ? 'bg-[var(--accent)] text-white animate-pulse'
                    : 'text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--accent)]'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:bg-[var(--panel)] disabled:text-[var(--muted)] transition cursor-pointer"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}