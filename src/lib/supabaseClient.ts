import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 未設定でもアプリが即クラッシュしないようにガード
let supabase: SupabaseClient | null = null;
if (url && key) {
  supabase = createClient(url, key);
} else {
  // 開発者向けログ（本番でもただのconsoleに出るだけ）
  // ここでthrowしない＝画面側で「未設定です」と案内できる
  console.error('Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.');
}

export { supabase };
