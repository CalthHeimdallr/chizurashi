'use client';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./components/MapView'), {
  ssr: false,
});

export default function Home() {
  return (
    <main style={{padding:'1rem'}}>
      <h1>地図らし紀行</h1>
      <p>地図をクリックすると、その場所に一句置けます。</p>
      <MapView/>
    </main>
  );
}
