'use client';

/**
 * ArtifactPanel - wysuwany panel z artefaktami (kod) po prawej stronie
 * Inspirowany panelem artefaktów z Claude.ai
 */

import { X, FileCode } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ArtifactTabs } from './ArtifactTabs';
import { ArtifactToolbar } from './ArtifactToolbar';
import type { Artifact } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ArtifactPanelProps {
  isOpen: boolean;
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  onClose: () => void;
  onSelectArtifact: (id: string) => void;
  onRemoveArtifact: (id: string) => void;
  onInsertToEditor?: (code: string, filename?: string, language?: string) => void;
}

// Mapowanie języków na klasę koloru składni
const languageHighlight: Record<string, string> = {
  typescript: 'language-typescript',
  tsx: 'language-tsx',
  javascript: 'language-javascript',
  jsx: 'language-jsx',
  python: 'language-python',
  css: 'language-css',
  html: 'language-html',
  json: 'language-json',
  sql: 'language-sql',
  markdown: 'language-markdown',
};

export function ArtifactPanel({
  isOpen,
  artifacts,
  activeArtifact,
  onClose,
  onSelectArtifact,
  onRemoveArtifact,
  onInsertToEditor,
}: ArtifactPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Zamknij panel na Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay na mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        ref={panelRef}
        className={cn(
          'fixed lg:relative right-0 top-0 h-full z-50 lg:z-auto',
          'w-[90vw] max-w-[450px] lg:w-[450px]',
          'bg-zinc-900 border-l border-zinc-800',
          'flex flex-col',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FileCode size={18} className="text-purple-400" />
            <h2 className="font-medium text-white">Artefakty</h2>
            {artifacts.length > 0 && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                {artifacts.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
            title="Zamknij panel (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <ArtifactTabs
          artifacts={artifacts}
          activeId={activeArtifact?.id || null}
          onSelect={onSelectArtifact}
          onClose={onRemoveArtifact}
        />

        {/* Toolbar */}
        <ArtifactToolbar
          activeArtifact={activeArtifact}
          artifacts={artifacts}
          onInsertToEditor={onInsertToEditor}
        />

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeArtifact ? (
            <div className="h-full">
              {/* Nazwa pliku */}
              <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <span className="text-sm text-zinc-400">
                  {activeArtifact.filename}
                </span>
                <span className="ml-2 text-xs text-zinc-600">
                  {activeArtifact.language}
                </span>
              </div>

              {/* Kod z podświetlaniem */}
              <div className="p-4 overflow-auto h-[calc(100%-40px)]">
                <pre
                  className={cn(
                    'text-sm font-mono leading-relaxed',
                    'text-zinc-300 whitespace-pre-wrap break-words',
                    languageHighlight[activeArtifact.language] || ''
                  )}
                >
                  <code>{activeArtifact.content}</code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <FileCode size={32} className="text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-zinc-400 mb-2">
                Brak artefaktów
              </h3>
              <p className="text-sm text-zinc-500 max-w-[280px]">
                Kliknij na blok kodu w chacie, aby otworzyć go tutaj jako artefakt
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
