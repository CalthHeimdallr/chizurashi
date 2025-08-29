// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '地図らし紀行 ───旅先や日常に歌を残そう',
  description: '地図に俳句や短歌を残して共有するサービス。旅先や日常の一瞬を歌に。いとをかしで共感も。',
  openGraph: {
    title: '地図らし紀行 ───旅先や日常に歌を残そう',
    description:
      '地図に俳句や短歌を残して共有するサービス。旅先や日常の一瞬を歌に。いとをかしで共感も。',
    url: '/',
    siteName: '地図らし紀行',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: '地図らし紀行 ───旅先や日常に歌を残そう',
    description:
      '地図に俳句や短歌を残して共有するサービス。旅先や日常の一瞬を歌に。いとをかしで共感も。',
  },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {/* 電話番号の自動リンクなどを抑止（任意） */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
