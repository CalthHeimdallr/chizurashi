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
};

export default function MapView() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [mode, setMode] = useState<Mode>('haiku');

  // 句の分割入力（短歌は4,5句も使う）
  const [lines, setLines] = useState({
    l1: '',
    l2: '',
    l3: '',
    l4: '',
    l5: '',
  });

  // クリックで選んだ座標を保持
  const [tempPos, setTempPos] = useState<{ lat: number; lon: number } | null>(
    null
  );

  // 地図クリックで位置を決める
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
    (mode === 'haiku' ||
      (mode === 'tanka' &&
        lines.l4.trim() !== '' &&
        lines.l5.trim() !== ''));

  const handleChange =
    (key: keyof typeof lines) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setLines((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = () => {
    if (!tempPos) return;
    // 表示用テキストを結合（改行区切り）
    const prepared =
      mode === 'haiku'
        ? [lines.l1, lines.l2, lines.l3]
        : [lines.l1, lines.l2, lines.l3, lines.l4, lines.l5];

    const text = prepared.map((s) => s.trim()).join('\n');

    const id = Date.now();
    setMarkers((m) => [
      { id, lat: tempPos.lat, lon: tempPos.lon, kind: mode, text },
      ...m,
    ]);

    // 入力リセット（位置は残す or 消すは好み。ここでは残す）
    setLines({ l1: '', l2: '', l3: '', l4: '', l5: '' });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '80vh' }}>
      <MapContainer
        center={[35.681, 139.767]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker />
        {tempPos && (
          <CircleMarker center={[tempPos.lat, tempPos.lon]} radius={8} />
        )}
        {markers.map((m) => (
          <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={6}>
            <Popup>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {m.kind === 'haiku' ? '俳句' : '短歌'}
              </p>
              <pre
                style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
              >
                {m.text}
              </pre>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* コンポーズパネル（固定／下部） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 -6px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            display: 'grid',
            gap: 8,
          }}
        >
          {/* モード切替 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontWeight: 600 }}>形式</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode('haiku')}
                aria-pressed={mode === 'haiku'}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border:
                    mode === 'haiku' ? '2px solid #111' : '1px solid #ccc',
                  background: mode === 'haiku' ? '#111' : '#fff',
                  color: mode === 'haiku' ? '#fff' : '#111',
                  cursor: 'pointer',
                }}
              >
                俳句を入力（5-7-5）
              </button>
              <button
                type="button"
                onClick={() => setMode('tanka')}
                aria-pressed={mode === 'tanka'}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border:
                    mode === 'tanka' ? '2px solid #111' : '1px solid #ccc',
                  background: mode === 'tanka' ? '#111' : '#fff',
                  color: mode === 'tanka' ? '#fff' : '#111',
                  cursor: 'pointer',
                }}
              >
                短歌を入力（5-7-5-7-7）
              </button>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#444' }}>
              {tempPos
                ? `選択位置: ${tempPos.lat.toFixed(5)}, ${tempPos.lon.toFixed(5)}（地図をクリックで変更）`
                : '地図をクリックして場所を選択'}
            </div>
          </div>

          {/* 句入力欄 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 6,
            }}
          >
            <input
              placeholder="一句目（例：古池や）"
              value={lines.l1}
              onChange={handleChange('l1')}
              style={inputStyle}
            />
            <input
              placeholder="二句目（例：蛙飛びこむ）"
              value={lines.l2}
              onChange={handleChange('l2')}
              style={inputStyle}
            />
            <input
              placeholder="三句目（例：水の音）"
              value={lines.l3}
              onChange={handleChange('l3')}
              style={inputStyle}
            />
            {mode === 'tanka' && (
              <>
                <input
                  placeholder="四句目"
                  value={lines.l4}
                  onChange={handleChange('l4')}
                  style={inputStyle}
                />
                <input
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
              title={
                tempPos
                  ? ''
                  : '投稿する前に、地図をクリックして場所を選んでください'
              }
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
};
