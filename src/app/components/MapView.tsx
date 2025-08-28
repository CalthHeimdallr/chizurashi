'use client';

import { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';

type Mode = 'haiku' | 'tanka';

type Marker = {
  id: number;
  lat: number;
  lon: number;
  kind: Mode;
  text: string;
  author: string;      // 署名
  createdAt: string;   // ISO文字列
};

export default function MapView() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [mode, setMode] = useState<Mode>('haiku');

  // 句の分割入力
  const [lines, setLines] = useState({ l1: '', l2: '', l3: '', l4: '', l5: '' });

  // 署名
  const [author, setAuthor] = useState<string>('');

  // クリックで選んだ座標
  const [tempPos, setTempPos] = useState<{ lat: number; lon: number } | null>(null);

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

  const handleSubmit = () => {
    if (!tempPos) return;

    const prepared =
      mode === 'haiku'
        ? [lines.l1, lines.l2, lines.l3]
        : [lines.l1, lines.l2, lines.l3, lines.l4, lines.l5];

    const text = prepared.map((s) => s.trim()).join('\n');

    const id = Date.now();
    setMarkers((m) => [
      {
        id,
        lat: tempPos.lat,
        lon: tempPos.lon,
        kind: mode,
        text,
        author: author.trim() || '無署名',
        createdAt: new Date().toISOString(),
      },
      ...m,
    ]);

    // 入力リセット（位置はそのまま残す）
    setLines({ l1: '', l2: '', l3: '', l4: '', l5: '' });
    // 署名は続けて使う前提で残す（消したい場合は下の行のコメントを外す）
    // setAuthor('');
  };

  const verticalTextStyle: React.CSSProperties = {
    margin: 0,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    writingMode: 'vertical-rl',   // ← 縦書き
    textOrientation: 'mixed',     // ← 句読点や英数の扱いを自然に
    fontSize: 16,
  };

  const metaVerticalStyle: React.CSSProperties = {
  marginTop: 8,
  display: 'inline-block',
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  lineHeight: 1.6,
  fontSize: 12,
  color: '#333', // 少し濃い
};


  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

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
        {markers.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={6}>
            <Popup maxWidth={320}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {m.kind === 'haiku' ? '俳句' : '短歌'}
              </p>

              {/* 縦書きの本文 */}
              <div style={{ marginTop: 6, display: 'inline-block' }}>
                <pre style={verticalTextStyle}>{m.text}</pre>
              </div>

{/* 署名・日付も縦書きで表示 */}
<div style={metaVerticalStyle}>
  <span>— {m.author}</span>
  {'\n'}
  <span>{formatDate(m.createdAt)}</span>
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
          {/* モード切替 & 現在位置 */}
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

          {/* 署名 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="署名（例：芭蕉）"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* 句入力欄 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <input
  className="poem-input"                         // ← 追加
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

{/* 短歌のみ */}
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

{/* 署名欄も濃く */}
<input
  className="poem-input"
  placeholder="署名（例：芭蕉）"
  value={author}
  onChange={(e) => setAuthor(e.target.value)}
  style={inputStyle}
/>
            )
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
              俳句は1〜3句、短歌は1〜5句を入力。地図をクリックで場所を選択できます。
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
