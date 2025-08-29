'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { supabase } from '../../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import AuthBar from './AuthBar';

type Mode = 'haiku' | 'tanka';

type PoemRow = {
  id: number;
  author: string;
  kind: Mode;
  text: string;
  lat: number;
  lon: number;
  created_at: string;
  likes: string[] | null;  // user.id の配列
  user_id: string | null;  // 著者のSupabaseユーザーID
};

export default function MapView() {
  // ===== Hooks（必ず先頭で定義）=====
  const [user, setUser] = useState<User | null>(null);
  const [poems, setPoems] = useState<PoemRow[]>([]);
  const [mode, setMode] = useState<Mode>('haiku');
  const [lines, setLines] = useState({ l1: '', l2: '', l3: '', l4: '', l5: '' });
  const [author, setAuthor] = useState<string>('');
  const [tempPos, setTempPos] = useState<{ lat: number; lon: number } | null>(null);
  const [hudOpen, setHudOpen] = useState(false); // ← 出し入れ制御

  // 固定セッション取得＆購読
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase!.auth.getUser();
      setUser(data.user ?? null);
      if (data.user) {
        const defaultName = data.user.user_metadata?.name || data.user.email || '';
        setAuthor(defaultName);
      }
    };
    init();
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setAuthor(u.user_metadata?.name || u.email || '');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 初回ロードで詩を取得（supabase未設定ならスキップ）
  useEffect(() => {
    if (!supabase) return;
    const fetchPoems = async () => {
      const { data, error } = await supabase!
        .from('poems')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setPoems((data || []).map((r) => ({ ...r, likes: r.likes ?? [] })));
    };
    fetchPoems();
  }, []);

  // ===== Supabase 未設定ガード（Hooksの後で判定）=====
  if (!supabase) {
    return (
      <div style={{ padding: 16 }}>
        <h3>設定が必要です</h3>
        <p>
          Vercel の Environment Variables に <code>NEXT_PUBLIC_SUPABASE_URL</code> と{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を追加し、再デプロイしてください。
        </p>
      </div>
    );
  }

  // 地図クリックで位置確定＋HUDを開く
  function Clicker() {
    useMapEvents({
      click(e: LeafletMouseEvent) {
        setTempPos({ lat: e.latlng.lat, lon: e.latlng.lng });
        setHudOpen(true); // ← ピンを刺したら開く
      },
    });
    return null;
  }

  const canSubmit: boolean =
    !!user && // RLSのため投稿はログイン必須
    !!tempPos &&
    !!lines.l1.trim() &&
    !!lines.l2.trim() &&
    !!lines.l3.trim() &&
    (mode === 'haiku' || (mode === 'tanka' && !!lines.l4.trim() && !!lines.l5.trim()));

  const handleChange =
    (key: keyof typeof lines) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setLines((prev) => ({ ...prev, [key]: e.target.value }));

  const prepareText = () =>
    (mode === 'haiku'
      ? [lines.l1, lines.l2, lines.l3]
      : [lines.l1, lines.l2, lines.l3, lines.l4, lines.l5]
    )
      .map((s) => s.trim())
      .join('\n');

  // HUDを閉じる（×／投稿成功で使用）
  const closeHUD = () => {
    setHudOpen(false);
    setTempPos(null); // ピンも消す（残したいならこの行を外す）
    setLines({ l1: '', l2: '', l3: '', l4: '', l5: '' });
  };

  // 投稿
  const handleSubmit = async () => {
    if (!tempPos || !user) return;
    const text = prepareText();
    const displayAuthor = (author || user.user_metadata?.name || user.email || '無署名').trim();

    const { data, error } = await supabase!
      .from('poems')
      .insert([
        {
          author: displayAuthor,
          kind: mode,
          text,
          lat: tempPos.lat,
          lon: tempPos.lon,
          user_id: user.id, // RLSのため必須
        },
      ])
      .select()
      .single();

    if (error) {
      alert('投稿に失敗しました: ' + error.message);
    } else if (data) {
      setPoems((prev) => [{ ...data, likes: data.likes ?? [] }, ...prev]);
      setLines({ l1: '', l2: '', l3: '', l4: '', l5: '' });
      closeHUD(); // ← 投稿後は収納
    }
  };

  // 権限判定
  const isOwner = (row: PoemRow) => !!user && row.user_id === user.id;

  // いとをかし（user.idベース）
  const toggleItoWokashi = async (row: PoemRow) => {
    if (!user) {
      alert('「いとをかし」にはログインが必要です。');
      return;
    }
    const current = row.likes ?? [];
    const nextLikes = current.includes(user.id)
      ? current.filter((n) => n !== user.id)
      : [...current, user.id];

    const { data, error } = await supabase!
      .from('poems')
      .update({ likes: nextLikes })
      .eq('id', row.id)
      .select()
      .single();

    if (error) {
      alert('いとをかし更新に失敗: ' + error.message);
    } else if (data) {
      setPoems((prev) =>
        prev.map((p) => (p.id === row.id ? { ...data, likes: data.likes ?? [] } : p)),
      );
    }
  };

  // 削除
  const deletePoem = async (row: PoemRow) => {
    if (!isOwner(row)) return;
    if (!confirm('この歌を削除しますか？')) return;

    const { error } = await supabase!.from('poems').delete().eq('id', row.id);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      setPoems((prev) => prev.filter((p) => p.id !== row.id));
    }
  };

  // 編集
  const editPoem = async (row: PoemRow) => {
    if (!isOwner(row)) return;
    const nextText = prompt('歌を修正', row.text);
    if (!nextText) return;

    const { data, error } = await supabase!
      .from('poems')
      .update({ text: nextText.trim() })
      .eq('id', row.id)
      .select()
      .single();

    if (error) {
      alert('更新に失敗しました: ' + error.message);
    } else if (data) {
      setPoems((prev) =>
        prev.map((p) => (p.id === row.id ? { ...data, likes: data.likes ?? [] } : p)),
      );
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const verticalTextStyle: React.CSSProperties = {
    margin: 0,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    fontSize: 16,
  };

  const metaVerticalStyle: React.CSSProperties = {
    marginTop: 8,
    display: 'inline-block',
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    lineHeight: 1.6,
    fontSize: 12,
    color: '#333',
  };

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    margin: '2px 0',
    padding: '8px 10px',
    border: '1.5px solid #555',
    borderRadius: 10,
    fontSize: 14,
    color: '#000000',
    background: '#fff',
    outline: 'none',
  };

  // ===== 描画 =====
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* 認証バー（右上固定） */}
      <AuthBar />

      <MapContainer center={[35.681, 139.767]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker />
        {tempPos && <CircleMarker center={[tempPos.lat, tempPos.lon]} radius={8} />}
        {poems.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={6}>
            <Popup maxWidth={360}>
              <p style={{ margin: 0, fontWeight: 600 }}>{m.kind === 'haiku' ? '俳句' : '短歌'}</p>

              {/* 本文（縦書き） */}
              <div style={{ marginTop: 6, display: 'inline-block' }}>
                <pre style={verticalTextStyle}>{m.text}</pre>
              </div>

              {/* 署名・日付（縦書き） */}
              <div style={metaVerticalStyle}>
                <span>— {m.author}</span>
                {'\n'}
                <span>{formatDate(m.created_at)}</span>
              </div>

              {/* 操作行 */}
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => toggleItoWokashi(m)}
                  title="いとをかし（いいね）"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid #111',
                    background: '#111',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  いとをかし {(m.likes ?? []).length}
                </button>

                {isOwner(m) && (
                  <>
                    <button
                      type="button"
                      onClick={() => editPoem(m)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid #888',
                        background: '#fff',
                        color: '#111',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePoem(m)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid #c33',
                        background: '#fff5f5',
                        color: '#c00',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* HUD（前面固定）— ピンを刺したら表示、×または投稿で収納 */}
      {hudOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 12,
            left: 12,
            right: 12,
            background: '#fff',
            padding: 12,
            zIndex: 1000,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
            borderRadius: 12,
            pointerEvents: 'auto',
          }}
        >
          {/* ×ボタン */}
          <button
            onClick={closeHUD}
            aria-label="閉じる"
            title="閉じる"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 999,
              border: '1px solid #bbb',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              lineHeight: '26px',
            }}
          >
            ×
          </button>

          <div style={{ display: 'grid', gap: 8, maxWidth: 880, margin: '0 auto' }}>
            {/* 形式切替 & 位置 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setMode('haiku')}
                  aria-pressed={mode === 'haiku'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: mode === 'haiku' ? '2px solid #111' : '1px solid #bbb',
                    background: mode === 'haiku' ? '#111' : '#fff',
                    color: mode === 'haiku' ? '#fff' : '#111',
                    cursor: 'pointer',
                  }}
                >
                  俳句（5-7-5）
                </button>
                <button
                  type="button"
                  onClick={() => setMode('tanka')}
                  aria-pressed={mode === 'tanka'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: mode === 'tanka' ? '2px solid #111' : '1px solid #bbb',
                    background: mode === 'tanka' ? '#111' : '#fff',
                    color: mode === 'tanka' ? '#fff' : '#111',
                    cursor: 'pointer',
                  }}
                >
                  短歌（5-7-5-7-7）
                </button>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#444' }}>
                {tempPos
                  ? `選択位置: ${tempPos.lat.toFixed(5)}, ${tempPos.lon.toFixed(5)}（地図クリックで変更）`
                  : '地図をクリックして場所を選択'}
              </div>
            </div>

            {/* 投稿署名（表示名） */}
            <input
              className="poem-input"
              style={inputStyle}
              placeholder="署名（表示名）"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={!user}
            />
            {!user && (
              <small style={{ color: '#a00' }}>
                ※ 投稿にはログインが必要です（右上からGoogle/GitHub/Discordでログイン）
              </small>
            )}

            {/* 句入力欄 */}
            <input
              className="poem-input"
              style={inputStyle}
              placeholder="一句目（例：古池や）"
              value={lines.l1}
              onChange={handleChange('l1')}
              disabled={!user}
            />
            <input
              className="poem-input"
              style={inputStyle}
              placeholder="二句目（例：蛙飛びこむ）"
              value={lines.l2}
              onChange={handleChange('l2')}
              disabled={!user}
            />
            <input
              className="poem-input"
              style={inputStyle}
              placeholder="三句目（例：水の音）"
              value={lines.l3}
              onChange={handleChange('l3')}
              disabled={!user}
            />
            {mode === 'tanka' && (
              <>
                <input
                  className="poem-input"
                  style={inputStyle}
                  placeholder="四句目"
                  value={lines.l4}
                  onChange={handleChange('l4')}
                  disabled={!user}
                />
                <input
                  className="poem-input"
                  style={inputStyle}
                  placeholder="五句目"
                  value={lines.l5}
                  onChange={handleChange('l5')}
                  disabled={!user}
                />
              </>
            )}

            {/* 投稿ボタン */}
            <div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: canSubmit ? '#111' : '#999',
                  color: '#fff',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                }}
                title={!tempPos ? '投稿前に地図をクリックして場所を選んでください' : ''}
              >
                この場所に詠む
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUDが閉じている時のガイド（任意） */}
      {!hudOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            zIndex: 900,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid #ddd',
            padding: '8px 10px',
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          地図をクリックして、この場所に歌を詠む
        </div>
      )}
    </div>
  );
}
