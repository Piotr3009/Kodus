'use client';

/**
 * ContextLoader - komponent do ładowania kontekstu projektu dla AI
 * Przyciski: "Załaduj kontekst repo" i "Dodaj plik"
 */

import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Plus, X, Check, Loader2, ChevronDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

interface AddedFile {
  path: string;
  content: string;
}

interface ContextLoaderProps {
  contextLoaded: boolean;
  addedFiles: AddedFile[];
  isLoading: boolean;
  onLoadContext: () => Promise<string | null>;
  onAddFile: (path: string) => Promise<string | null>;
  onRemoveFile: (path: string) => void;
}

export function ContextLoader({
  contextLoaded,
  addedFiles,
  isLoading,
  onLoadContext,
  onAddFile,
  onRemoveFile,
}: ContextLoaderProps) {
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Pobierz listę plików
  const fetchFiles = useCallback(async (path: string) => {
    setLoadingFiles(true);
    try {
      const params = new URLSearchParams({ path });
      const response = await fetch(`/api/files/list?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setCurrentPath(path);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // Pobierz pliki przy otwarciu
  useEffect(() => {
    if (showFilePicker) {
      fetchFiles('.');
    }
  }, [showFilePicker, fetchFiles]);

  // Obsługa kliknięcia na plik/folder
  const handleFileClick = async (file: FileInfo) => {
    if (file.type === 'dir') {
      fetchFiles(file.path);
    } else {
      await onAddFile(file.path);
      setShowFilePicker(false);
    }
  };

  // Nawigacja w górę
  const goUp = () => {
    if (currentPath === '.' || currentPath === '') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '.';
    fetchFiles(parentPath);
  };

  // Wyciągnij nazwę pliku ze ścieżki
  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  return (
    <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Przycisk załaduj kontekst */}
        <button
          onClick={onLoadContext}
          disabled={isLoading || contextLoaded}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            contextLoaded
              ? 'bg-green-900/30 text-green-400 border border-green-800'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading && !showFilePicker ? (
            <Loader2 size={16} className="animate-spin" />
          ) : contextLoaded ? (
            <Check size={16} />
          ) : (
            <FolderOpen size={16} />
          )}
          {contextLoaded ? 'Kontekst załadowany' : 'Załaduj kontekst repo'}
        </button>

        {/* Przycisk dodaj plik */}
        <div className="relative">
          <button
            onClick={() => setShowFilePicker(!showFilePicker)}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              showFilePicker && 'bg-purple-900/30 border-purple-700'
            )}
          >
            <Plus size={16} />
            Dodaj plik
            <ChevronDown size={14} className={cn('transition-transform', showFilePicker && 'rotate-180')} />
          </button>

          {/* Dropdown z listą plików */}
          {showFilePicker && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
              {/* Nagłówek z nawigacją */}
              <div className="px-3 py-2 border-b border-zinc-700 bg-zinc-900/50 flex items-center gap-2">
                <FileText size={14} className="text-zinc-500" />
                <span className="text-xs text-zinc-400 truncate flex-1">{currentPath}</span>
                {currentPath !== '.' && (
                  <button
                    onClick={goUp}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    ← wróć
                  </button>
                )}
              </div>

              {/* Lista plików */}
              <div className="max-h-64 overflow-y-auto">
                {loadingFiles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-zinc-500" />
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-4 text-center text-zinc-500 text-sm">
                    Brak plików
                  </div>
                ) : (
                  files.map((file) => {
                    const isAdded = addedFiles.some(f => f.path === file.path);
                    return (
                      <button
                        key={file.path}
                        onClick={() => handleFileClick(file)}
                        disabled={isAdded}
                        className={cn(
                          'w-full px-3 py-2 flex items-center gap-2 text-left text-sm',
                          'hover:bg-zinc-700/50 transition-colors',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          isAdded && 'bg-purple-900/20'
                        )}
                      >
                        {file.type === 'dir' ? (
                          <FolderOpen size={14} className="text-yellow-500 flex-shrink-0" />
                        ) : (
                          <FileText size={14} className="text-zinc-500 flex-shrink-0" />
                        )}
                        <span className={cn(
                          'truncate',
                          file.type === 'dir' ? 'text-yellow-300' : 'text-zinc-300'
                        )}>
                          {file.name}
                        </span>
                        {isAdded && (
                          <Check size={12} className="text-green-400 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Zamknij */}
              <div className="px-3 py-2 border-t border-zinc-700 bg-zinc-900/50">
                <button
                  onClick={() => setShowFilePicker(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-400"
                >
                  Zamknij
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista dodanych plików (badge'y) */}
        {addedFiles.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {addedFiles.map((file) => (
              <span
                key={file.path}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-900/30 border border-purple-800 text-xs text-purple-300"
              >
                {getFileName(file.path)}
                <button
                  onClick={() => onRemoveFile(file.path)}
                  className="hover:text-purple-100 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
