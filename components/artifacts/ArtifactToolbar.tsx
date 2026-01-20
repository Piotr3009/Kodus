'use client';

/**
 * ArtifactToolbar - pasek narzędzi dla artefaktu
 * Przyciski: Kopiuj, Pobierz, Pobierz ZIP, Wstaw do edytora
 */

import { Copy, Download, FileArchive, FileInput, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { downloadFile, downloadAsZip } from '@/lib/download';
import type { Artifact } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ArtifactToolbarProps {
  activeArtifact: Artifact | null;
  artifacts: Artifact[];
  onInsertToEditor?: (code: string, filename?: string, language?: string) => void;
}

export function ArtifactToolbar({
  activeArtifact,
  artifacts,
  onInsertToEditor,
}: ArtifactToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Kopiuj do schowka
  const handleCopy = useCallback(async () => {
    if (!activeArtifact) return;

    try {
      await navigator.clipboard.writeText(activeArtifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Błąd kopiowania:', err);
    }
  }, [activeArtifact]);

  // Pobierz pojedynczy plik
  const handleDownload = useCallback(() => {
    if (!activeArtifact) return;
    downloadFile(activeArtifact.content, activeArtifact.filename);
  }, [activeArtifact]);

  // Pobierz wszystkie jako ZIP
  const handleDownloadZip = useCallback(async () => {
    if (artifacts.length === 0) return;

    setIsDownloading(true);
    try {
      const files = artifacts.map((a) => ({
        name: a.filename,
        content: a.content,
      }));
      await downloadAsZip(files, 'kodus-artifacts.zip');
    } catch (err) {
      console.error('Błąd pobierania ZIP:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [artifacts]);

  // Wstaw do edytora
  const handleInsertToEditor = useCallback(() => {
    if (!activeArtifact || !onInsertToEditor) return;
    onInsertToEditor(
      activeArtifact.content,
      activeArtifact.filename,
      activeArtifact.language
    );
  }, [activeArtifact, onInsertToEditor]);

  const buttonClass = cn(
    'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
    'text-zinc-400 hover:text-white hover:bg-zinc-700',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
      {/* Kopiuj */}
      <button
        onClick={handleCopy}
        disabled={!activeArtifact}
        className={buttonClass}
        title="Kopiuj do schowka"
      >
        {copied ? (
          <>
            <Check size={14} className="text-green-400" />
            <span className="text-green-400">Skopiowano</span>
          </>
        ) : (
          <>
            <Copy size={14} />
            <span className="hidden sm:inline">Kopiuj</span>
          </>
        )}
      </button>

      {/* Pobierz */}
      <button
        onClick={handleDownload}
        disabled={!activeArtifact}
        className={buttonClass}
        title="Pobierz plik"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Pobierz</span>
      </button>

      {/* Pobierz ZIP */}
      <button
        onClick={handleDownloadZip}
        disabled={artifacts.length === 0 || isDownloading}
        className={buttonClass}
        title="Pobierz wszystkie jako ZIP"
      >
        <FileArchive size={14} />
        <span className="hidden sm:inline">
          {isDownloading ? 'Pobieram...' : 'ZIP'}
        </span>
        {artifacts.length > 1 && (
          <span className="text-xs text-zinc-500">({artifacts.length})</span>
        )}
      </button>

      {/* Separator */}
      <div className="w-px h-4 bg-zinc-700 mx-1" />

      {/* Wstaw do edytora */}
      {onInsertToEditor && (
        <button
          onClick={handleInsertToEditor}
          disabled={!activeArtifact}
          className={cn(buttonClass, 'text-purple-400 hover:text-purple-300')}
          title="Wstaw do edytora"
        >
          <FileInput size={14} />
          <span className="hidden sm:inline">Wstaw do edytora</span>
        </button>
      )}
    </div>
  );
}
