'use client';

/**
 * ArtifactTabs - zakładki dla otwartych artefaktów
 * Podobne do zakładek w IDE, maksymalnie 5 plików
 */

import { X, FileCode } from 'lucide-react';
import type { Artifact } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ArtifactTabsProps {
  artifacts: Artifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

// Mapowanie języków na kolory
const languageColors: Record<string, string> = {
  typescript: 'bg-blue-500',
  tsx: 'bg-blue-500',
  javascript: 'bg-yellow-500',
  jsx: 'bg-yellow-500',
  python: 'bg-green-500',
  css: 'bg-pink-500',
  html: 'bg-orange-500',
  json: 'bg-gray-500',
  sql: 'bg-purple-500',
  markdown: 'bg-gray-400',
};

export function ArtifactTabs({
  artifacts,
  activeId,
  onSelect,
  onClose,
}: ArtifactTabsProps) {
  if (artifacts.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border-b border-zinc-800 overflow-x-auto scrollbar-hide">
      {artifacts.map((artifact) => {
        const isActive = artifact.id === activeId;
        const colorClass = languageColors[artifact.language] || 'bg-zinc-500';

        return (
          <div
            key={artifact.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm cursor-pointer transition-colors',
              'min-w-0 max-w-[180px]',
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            )}
            onClick={() => onSelect(artifact.id)}
          >
            {/* Wskaźnik języka */}
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colorClass)} />

            {/* Ikona pliku */}
            <FileCode size={14} className="flex-shrink-0 text-zinc-500" />

            {/* Nazwa pliku */}
            <span className="truncate">{artifact.filename}</span>

            {/* Przycisk zamknij */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(artifact.id);
              }}
              className={cn(
                'ml-1 p-0.5 rounded hover:bg-zinc-700 transition-colors flex-shrink-0',
                'opacity-0 group-hover:opacity-100',
                isActive && 'opacity-100'
              )}
              title="Zamknij"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
