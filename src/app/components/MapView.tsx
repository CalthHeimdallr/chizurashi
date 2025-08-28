'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { supabase } from '../../lib/supabaseClient';

type Mode = 'haiku' | 'tanka';

type PoemRow = {
  id: number;
  author: string;
  kind: Mode;
  text: string;
  lat: number;
  lon: number;
  created_at: string;
  likes: string[] | null;
};

export default function MapView() {
  // Supabase が未設定の場合はエラーメッセージを返す
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

  const [poems, setPoems] = useState<PoemRow[]>([]);
  const [mode, setMode] = useState<Mode>('haiku');
  const [lines, setLines] = useState({ l1: '', l2: '', l3: '', l4: '', l5: '' });
  const [author, setAuthor] = useState<string>('');
  const [myName, setMyName] = useState<string>('');
  const [tempPos, setTempPos] = useState<{ lat: number; lon: number } | null>(null);

  // 固定署名を localStorage から読み込み
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('chizurashi_myName')) || '';
    if (saved) {
      setMyName(saved);
      setAuthor(saved);
    }
  }, []);

  // 投稿一覧を Supabase から取得
  useEffect(() => {
    const fetchPoems = async () => {
      const { data, error } = await supabase
        .from('poems')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        alert('投稿の取得に失敗しました: ' + error.message);
      } else {
        setPoems((data || []).map((r) => ({ ...r, likes: r.likes ?? [] })));
      }
    };
    fetchPoems();
  }, []);

  function Clicker() {
    useMapEvents({
      click(e: LeafletMouseEvent) {
        setTempPos({ lat: e.latlng.lat, lon: e.latlng.lng });
      },
    });
    return null;
  }

  const canSubmit =
    !!tempPos &&
    lines.l1.trim() &&
    lines.l2.trim() &&
    lines.l3.trim() &&
    (mode === 'haiku' || (mode === 'tanka' && lines.l4.trim() && lines.l5.trim()));

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

  const handleSubmit = async () => {
    if (!tempPos) return;
    const text = prepareText();
    const finalAuthor = (author || myName || '無署名').trim();

    const { data, error } = await supabase
      .from('poems')
      .insert([{ author: finalAuthor, kind: mode, text, lat: tempPos.lat, lon: tempPos.lon }])
      .select()
      .single();

    if (error) {
      alert('投稿に失敗しました: ' + error.message);
    } else if (data) {
      setPoems((prev) => [{ ...data, likes: data.likes ?? [] }, ...prev]);
      setLines({ l1: '', l2: '', l3: '', l4: '', l5: '' });
    }
  };

  const isOwner = (row: PoemRow) => myName && row.author === myName;

  const toggleItoWokashi = async (row: PoemRow) => {
    if (!myName) {
      alert('まず「あなたの署名（固定）」を設定してください。');
      return;
    }
    const current = row.likes ?? [];
    const nextLikes = current.includes(myName)
      ? current.filter((n) => n !== myName)
      : [...current, myName];

    const { data, error } = await supabase
      .from('poems')
      .update({ likes: nextLikes })
      .eq('id', row.id)
      .select()
      .single();

    if (error) {
      alert('いとをかし更新に失敗: ' + error.message);
    } else if (data) {
      setPoems((prev) => prev.map((p) => (p.id === row.id ? { ...data, likes: data.likes ?? [] } : p)));
    }
  };

  const deletePoem = async (row: PoemRow) => {
    if (!isOwner(row)) return;
    if (!confirm('この歌を削除しますか？')) return;

    const { error } = await supabase.from('poems').delete().eq('id', row.id);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      setPoems((prev) => prev.filter((p) => p.id !== row.id));
    }
  };

  const editPoem = async (row: PoemRow) => {
    if (!isOwner(row)) return;
    const nextText = prompt('歌を修正', row.text);
    if (!nextText) return;

    const { data, error } = await supabase
      .from('poems')
      .update({ text: nextText.trim() })
      .eq('id', row.id)
      .select()
      .single();

    if (error) {
      alert('更新に失敗しました: ' + error.message);
    } else if (data) {
      setPoems((prev) => prev.map((p) => (p.id === row.id ? { ...data, likes: data.likes ?? [] } : p)));
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <MapContainer center={[35.681, 139.767]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker />
        {tempPos && <CircleMarker center={[tempPos.lat, tempPos.lon]} radius={8} />}
        {poems.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={6}>
            <Popup maxWidth={340}>
              <pre style={verticalTextStyle}>{m.text}</pre>
              <div style={metaVerticalStyle}>
                — {m.author}
                {'\n'}
                {formatDate(m.created_at)}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button onClick={() => toggleItoWokashi(m)}>いとをかし {(m.likes ?? []).length}</button>
                {isOwner(m) && (
                  <>
                    <button onClick={() => editPoem(m)}>編集</button>
                    <button onClick={() => deletePoem(m)}>削除</button>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* HUD */}
      <div style={{ position: 'fixed', bottom: 12, left: 12, right: 12, background: '#fff', padding: 12 }}>
        <div>
          <input
            placeholder="あなたの署名（固定）"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            onBlur={() => localStorage.setItem('chizurashi_myName', myName.trim())}
          />
          <button onClick={() => setMode('haiku')}>俳句</button>
          <button onClick={() => setMode('tanka')}>短歌</button>
        </div>
        <input placeholder="投稿署名" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <input placeholder="一句目" value={lines.l1} onChange={handleChange('l1')} />
        <input placeholder="二句目" value={lines.l2} onChange={handleChange('l2')} />
        <input placeholder="三句目" value={lines.l3} onChange={handleChange('l3')} />
        {mode === 'tanka' && (
          <>
            <input placeholder="四句目" value={lines.l4} onChange={handleChange('l4')} />
            <input placeholder="五句目" value={lines.l5} onChange={handleChange('l5')} />
          </>
        )}
        <button disabled={!canSubmit} onClick={handleSubmit}>
          この場所に詠む
        </button>
      </div>
    </div>
  );
}
