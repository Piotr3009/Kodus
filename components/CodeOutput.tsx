/**
 * CodeOutput - wyświetla kod wynikowy w Monaco Editor
 * Read-only, ciemny motyw, kopiowanie, pobieranie
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Download, Check, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectLanguage } from '@/lib/constants';
import { copyToClipboard, downloadStringAsFile, getMimeType, cn } from '@/lib/utils';
import { toast } from 'sonner';

// Dynamiczny import Monaco Editor (bez SSR)
const Editor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full flex items-center justify-center bg-card rounded-lg border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          Ładowanie edytora...
        </div>
      </div>
    ),
  }
);

interface CodeOutputProps {
  code: string | null;
  language?: string;
  filename?: string;
  isLoading?: boolean;
}

export function CodeOutput({
  code,
  language,
  filename = 'output.tsx',
  isLoading = false,
}: CodeOutputProps) {
  const [copied, setCopied] = useState(false);

  // Wykryj język na podstawie kodu lub nazwy pliku
  const detectedLanguage = useMemo(() => {
    if (language) return language;
    if (code) return detectLanguage(code, filename);
    return 'typescript';
  }, [code, language, filename]);

  // Rozszerzenie pliku
  const fileExtension = useMemo(() => {
    const languageToExtension: Record<string, string> = {
      typescript: 'tsx',
      javascript: 'js',
      css: 'css',
      json: 'json',
      sql: 'sql',
      html: 'html',
      markdown: 'md',
      python: 'py',
    };
    return languageToExtension[detectedLanguage] || 'txt';
  }, [detectedLanguage]);

  // Nazwa pliku do pobrania
  const downloadFilename = useMemo(() => {
    if (filename && !filename.includes('.')) {
      return `${filename}.${fileExtension}`;
    }
    return filename || `output.${fileExtension}`;
  }, [filename, fileExtension]);

  // Kopiowanie do schowka
  const handleCopy = useCallback(async () => {
    if (!code) return;

    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      toast.success('Skopiowano do schowka');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Nie udało się skopiować');
    }
  }, [code]);

  // Pobieranie pliku
  const handleDownload = useCallback(() => {
    if (!code) return;

    downloadStringAsFile(code, downloadFilename, getMimeType(fileExtension));
    toast.success(`Pobrano plik: ${downloadFilename}`);
  }, [code, downloadFilename, fileExtension]);

  // Gdy brak kodu
  if (!code && !isLoading) {
    return (
      <div className="h-[400px] w-full flex flex-col items-center justify-center bg-card rounded-lg border text-muted-foreground">
        <FileCode className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Brak kodu do wyświetlenia</p>
        <p className="text-sm">Wyślij zadanie, aby wygenerować kod</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[400px] w-full bg-card rounded-lg border overflow-hidden">
        {/* Skeleton dla paska narzędzi */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="skeleton h-4 w-24 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-8 w-20 rounded" />
            <div className="skeleton h-8 w-20 rounded" />
          </div>
        </div>
        {/* Skeleton dla kodu */}
        <div className="p-4 space-y-2">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="skeleton h-4 rounded"
              style={{ width: `${Math.random() * 40 + 40}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-card rounded-lg border overflow-hidden">
      {/* Pasek narzędzi */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{downloadFilename}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            {detectedLanguage}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Skopiowano
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Kopiuj
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8"
          >
            <Download className="h-4 w-4" />
            Pobierz
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <Editor
        height="400px"
        language={detectedLanguage}
        value={code || ''}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: 'none',
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          contextmenu: false,
        }}
        className={cn('rounded-b-lg')}
      />

      {/* Liczba linii */}
      <div className="px-3 py-2 border-t bg-muted/30 flex justify-between text-xs text-muted-foreground">
        <span>{code?.split('\n').length || 0} linii</span>
        <span>{code?.length || 0} znaków</span>
      </div>
    </div>
  );
}

export default CodeOutput;
