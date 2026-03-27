import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Round1 Dashboard | Grapevine',
  description: 'Live operational dashboard for Round1 interview coordination',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
