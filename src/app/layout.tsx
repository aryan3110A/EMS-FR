import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { ToastProvider } from '@/components/providers/toast-provider';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

export const metadata: Metadata = {
  title: {
    default: 'Raj Foods EMS',
    template: '%s · Raj Foods EMS',
  },
  description: 'Raj Foods Export Management System: contracts, production, inventory, quality and dispatch',
  applicationName: 'Raj Foods EMS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
