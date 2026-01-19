'use client';

/**
 * FileTabs - zakładki plików w edytorze
 */

import { X, FileCode, Plus } from 'lucide-react';
import type { EditorFile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FileTabsProps {
  files: EditorFile[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew?: () => void;
}

export function FileTabs({ files, activeFileId, onSelect, onClose, onNew }: FileTabsProps) {
  if (files.length === 0 && !onNew) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border-b border-zinc-800 overflow-x-auto">
      {files.map((file) => {
        const isActive = file.id === activeFileId;

        return (
          <div
            key={file.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer',
              'transition-colors',
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            )}
            onClick={() => onSelect(file.id)}
          >
            <FileCode size={14} />
            <span className="text-sm truncate max-w-[120px]">{file.name}</span>

            {/* Dirty indicator */}
            {file.isDirty && (
              <span className="w-2 h-2 rounded-full bg-orange-500" title="Niezapisane zmiany" />
            )}

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.id);
              }}
              className={cn(
                'p-0.5 rounded hover:bg-zinc-700 transition-colors',
                'opacity-0 group-hover:opacity-100',
                isActive && 'opacity-100'
              )}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* New file button */}
      {onNew && (
        <button
          onClick={onNew}
          className="flex items-center gap-1 px-2 py-1.5 text-zinc-500 hover:text-white transition-colors"
          title="Nowy plik"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
