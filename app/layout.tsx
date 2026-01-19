/**
 * Root Layout - główny layout aplikacji AI Agent Dashboard
 * Używa system fonts dla niezawodności (bez Google Fonts)
 */

import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

// Metadata
export const metadata: Metadata = {
  title: 'AI Agent Dashboard',
  description: 'Multi-LLM system do generowania kodu przez Claude, GPT i Gemini',
  keywords: ['AI', 'LLM', 'Claude', 'GPT', 'Gemini', 'code generation', 'dashboard'],
  authors: [{ name: 'AI Agent Dashboard' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="dark">
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}

        {/* Toast notifications (sonner) */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            },
          }}
          closeButton
          richColors
        />
      </body>
    </html>
  );
}
