'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export default function AuthBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase!.auth.getUser();
      setUser(data.user ?? null);
    };
    init();

    const { data: sub } = supabase!.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (provider: 'google' | 'github' | 'discord') => {
    await supabase!.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase!.auth.signOut();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 1100,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(6px)',
        padding: '8px 10px',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
      }}
    >
      {user ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#333' }}>
            {user.user_metadata?.name || user.email}
          </span>
          <button onClick={signOut} style={btn()}>
            ログアウト
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => signIn('google')} style={btn()}>
            Googleでログイン
          </button>
          <button onClick={() => signIn('github')} style={btn()}>
            GitHub
          </button>
          <button onClick={() => signIn('discord')} style={btn()}>
            Discord
          </button>
        </div>
      )}
    </div>
  );
}

const btn = (): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
});
