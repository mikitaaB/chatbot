import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { ChatSidebar } from '@/components/sidebar/ChatSidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex">
            <ChatSidebar />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
