'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

// FIXED (Performance): AIBuddy pulls in framer-motion + the chat UI, and
// was previously bundled into every protected page's initial JS even
// though it starts collapsed. Loading it dynamically with `ssr: false`
// defers that cost until the client actually needs it, without changing
// how or when it appears to the user.
const AIBuddy = dynamic(() => import('@/app/components/AIBuddy'), { ssr: false });

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setAuthChecked(true);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.push('/login');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      <Navbar onMenuClick={() => setMobileNavOpen((v) => !v)} />

      <div className="flex flex-1">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <main className="flex-1 min-w-0 w-full">
          {!authChecked ? (
            <div className="flex h-full items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)]" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Floating AI Buddy Widget */}
      {authChecked && <AIBuddy />}
    </div>
  );
}