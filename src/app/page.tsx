import MapView from './components/MapView';

export default function Home() {
  return (
    <main style={{padding:'1rem'}}>
      <h1>地図らし紀行（ローカル版）</h1>
      <p>地図をクリックすると、その場所に一句置けます（まだ保存はされません）。</p>
      <MapView/>
    </main>
  );
}
