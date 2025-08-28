'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { supabase } from '../../lib/supabaseClient';

export default function MapView() {
  // supabase が存在しなければ警告画面を返す
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

  // ここから通常の処理（useState, useEffect, MapContainer など）
  // …
}



type Mode = 'haiku' | 'tanka';

/** DBのpoemsテーブル行 */
type PoemRow = {
  id: number;
  author: string;
  kind: Mode;
  text: string;
  lat: number;
  lon: number;
  created_at: string;   // Supabase側の列名に合わせる
  likes: string[] | null;
};

export default function MapView() {
  const [poems, setPoems] = useState<PoemRow[]>([]);
  const [mode, setMode] = useState<Mode>('haiku');

  // 句の分割入力
  const [lines, setLines] = useState({ l1: '', l2: '', l3: '', l4: '', l5: '' });

  // 投稿ごとの署名（デフォルトは myName を使う）
  const [author, setAuthor] = useState<string>('');

  // あなたの署名（固定）— 権限と「いとをかし」に利用、localStorageに保持
  const [myName, setMyName] = useState<string>('');

  // クリックで選んだ座標
  const [tempPos, setTempPos] = useState<{ lat: number; lon: number } | null>(null);

  // 初回：固定署名(myName)をlocalStorageから復元
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('chizurashi_myName')) || '';
    if (saved) {
      setMyName(saved);
      setAuthor(saved);
    }
  }, []);

  // 初回：DBから詩を取得
  useEffect(() => {
    const fetchPoems = async () => {
      const { data, error } = await supabase
        .from('poems')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        alert('投稿の取得に失敗しました：' + error.message);
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
    lines.l1.trim() !== '' &&
    lines.l2.trim() !== '' &&
    lines.l3.trim() !== '' &&
    (mode === 'haiku' || (mode === 'tanka' && lines.l4.trim() !== '' && lines.l5.trim() !== ''));

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
      .insert([
        {
          author: finalAuthor,
          kind: mode,
          text,
          lat: tempPos.lat,
          lon: tempPos.lon,
        },
      ])
      .select()
      .single();

    if (error) {
      alert('投稿に失敗しました：' + error.message);
    } else if (data) {
      setPoems((prev) => [{ ...data, likes: data.likes ?? [] }, ...prev]);
      setLines({ l1: '', l2: '', l3: '', l4: '', l5: '' });
    }
  };

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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

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
      alert('いとをかし更新に失敗：' + error.message);
    } else if (data) {
      setPoems((prev) => prev.map((p) => (p.id === row.id ? { ...data, likes: data.likes ?? [] } : p)));
    }
  };

  const deletePoem = async (row: PoemRow) => {
    if (!isOwner(row)) {
      alert('この投稿を削除できるのは作者本人のみです。');
      return;
    }
    if (!confirm('この歌を削除しますか？')) return;

    const { error } = await supabase.from('poems').delete().eq('id', row.id);
    if (error) {
      alert('削除に失敗しました：' + error.message);
      return;
    }
    setPoems((prev) => prev.filter((p) => p.id !== row.id));
  };

  const editPoem = async (row: PoemRow) => {
    if (!isOwner(row)) {
      alert('この投稿を編集できるのは作者本人のみです。');
      return;
    }
    const nextText = prompt('歌を修正', row.text);
    if (nextText == null || nextText.trim() === '') return;

    const { data, error } = await supabase
      .from('poems')
      .update({ text: nextText.trim() })
      .eq('id', row.id)
      .select()
      .single();

    if (error) {
      alert('更新に失敗しました：' + error.message);
    } else if (data) {
      setPoems((prev) => prev.map((p) => (p.id === row.id ? { ...data, likes: data.likes ?? [] } : p)));
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <MapContainer
        center={[35.681, 139.767]}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker />
        {tempPos && <CircleMarker center={[tempPos.lat, tempPos.lon]} radius={8} />}
        {poems.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={6}>
            <Popup maxWidth={340}>
              <p style={{ margin: 0, fontWeight: 600 }}>{m.kind === 'haiku' ? '俳句' : '短歌'}</p>

              {/* 縦書き本文 */}
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
                  style={chipButton((m.likes ?? []).includes(myName))}
                  title="いとをかし（いいね）"
                >
                  いとをかし {(m.likes ?? []).length > 0 ? `(${(m.likes ?? []).length})` : ''}
                </button>

                {isOwner(m) && (
                  <>
                    <button type="button" onClick={() => editPoem(m)} style={chipButton(false)}>
                      編集
                    </button>
                    <button type="button" onClick={() => deletePoem(m)} style={chipButton(false, true)}>
                      削除
                    </button>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* 入力HUD（画面固定） */}
      <div
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          zIndex: 1000,
          padding: '12px',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(6px)',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 8 }}>
          {/* あなたの署名（固定） */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ minWidth: 120, fontWeight: 600 }}>あなたの署名（固定）</label>
            <input
              className="poem-input"
              placeholder="例：芭蕉"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onBlur={() => localStorage.setItem('chizurashi_myName', myName.trim())}
              style={inputStyle}
            />
            <small style={{ color: '#555' }}>※ 編集/削除や「いとをかし」に使われます</small>
          </div>

          {/* 形式切替 & 位置 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode('haiku')}
                aria-pressed={mode === 'haiku'}
                style={modeBtnStyle(mode === 'haiku')}
              >
                俳句（5-7-5）
              </button>
              <button
                type="button"
                onClick={() => setMode('tanka')}
                aria-pressed={mode === 'tanka'}
                style={modeBtnStyle(mode === 'tanka')}
              >
                短歌（5-7-5-7-7）
              </button>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#444' }}>
              {tempPos
                ? `選択位置: ${tempPos.lat.toFixed(5)}, ${tempPos.lon.toFixed(5)}`
                : '地図をクリックして場所を選択'}
            </div>
          </div>

          {/* 投稿署名（デフォルトは固定署名） */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="poem-input"
              placeholder="署名（投稿ごとに上書き可）"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* 句入力欄 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <input
              className="poem-input"
              placeholder="一句目（例：古池や）"
              value={lines.l1}
              onChange={handleChange('l1')}
              style={inputStyle}
            />
            <input
              className="poem-input"
              placeholder="二句目（例：蛙飛びこむ）"
              value={lines.l2}
              onChange={handleChange('l2')}
              style={inputStyle}
            />
            <input
              className="poem-input"
              placeholder="三句目（例：水の音）"
              value={lines.l3}
              onChange={handleChange('l3')}
              style={inputStyle}
            />
            {mode === 'tanka' && (
              <>
                <input
                  className="poem-input"
                  placeholder="四句目"
                  value={lines.l4}
                  onChange={handleChange('l4')}
                  style={inputStyle}
                />
                <input
                  className="poem-input"
                  placeholder="五句目"
                  value={lines.l5}
                  onChange={handleChange('l5')}
                  style={inputStyle}
                />
              </>
            )}
          </div>

          {/* 投稿ボタン */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            <small style={{ color: '#666' }}>
              固定署名＝あなたの本人確認。投稿署名が固定署名と一致する歌のみ編集/削除できます。
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  outline: 'none',
  width: '100%',
};

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 8,
  border: active ? '2px solid #111' : '1px solid #ccc',
  background: active ? '#111' : '#fff',
  color: active ? '#fff' : '#111',
  cursor: 'pointer',
});

const chipButton = (active: boolean, danger = false): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid ' + (danger ? '#c33' : active ? '#111' : '#aaa'),
  background: danger ? '#fff5f5' : active ? '#111' : '#fff',
  color: danger ? '#c00' : active ? '#fff' : '#111',
  cursor: 'pointer',
  fontSize: 12,
});
