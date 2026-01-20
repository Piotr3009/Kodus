/**
 * Komponent FileExplorer - panel do przeglądania plików projektu
 * Pozwala na wyświetlanie struktury, nawigację i kopiowanie ścieżek
 */

'use client';

import { useState, useEffect } from 'react';
import { useFiles, FileInfo } from '@/hooks/useFiles';

interface FileExplorerProps {
  onPathCopy?: (path: string) => void;
  className?: string;
}

export function FileExplorer({ onPathCopy, className = '' }: FileExplorerProps) {
  const {
    files,
    tree,
    currentPath,
    isLoading,
    error,
    listFiles,
    getTree,
    goUp,
    clearError,
  } = useFiles();

  const [view, setView] = useState<'list' | 'tree'>('list');
  const [isOpen, setIsOpen] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Załaduj listę plików przy pierwszym otwarciu
  useEffect(() => {
    if (isOpen && files.length === 0 && view === 'list') {
      listFiles('.');
    }
  }, [isOpen, files.length, view, listFiles]);

  // Załaduj drzewo przy przełączeniu na widok drzewa
  useEffect(() => {
    if (isOpen && view === 'tree' && !tree) {
      getTree();
    }
  }, [isOpen, view, tree, getTree]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    onPathCopy?.(path);

    // Reset po 2 sekundach
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleFileClick = (file: FileInfo) => {
    if (file.type === 'dir') {
      listFiles(file.path);
    } else {
      handleCopyPath(file.path);
    }
  };

  const handleShowTree = () => {
    setView('tree');
    if (!tree) {
      getTree();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors ${className}`}
      >
        <FolderIcon />
        <span>Pliki projektu</span>
      </button>
    );
  }

  return (
    <div className={`bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <FolderIcon />
          <span className="text-sm font-medium">Pliki projektu</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('list')}
            className={`px-2 py-1 text-xs rounded ${view === 'list' ? 'bg-zinc-600' : 'hover:bg-zinc-700'}`}
            title="Widok listy"
          >
            Lista
          </button>
          <button
            onClick={handleShowTree}
            className={`px-2 py-1 text-xs rounded ${view === 'tree' ? 'bg-zinc-600' : 'hover:bg-zinc-700'}`}
            title="Widok drzewa"
          >
            Drzewo
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="ml-2 p-1 hover:bg-zinc-700 rounded"
            title="Zamknij"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-900/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="hover:text-red-300">
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-zinc-500">
            <LoadingSpinner />
            <span className="ml-2">Ładowanie...</span>
          </div>
        ) : view === 'list' ? (
          <div className="py-1">
            {/* Breadcrumb / Navigation */}
            {currentPath !== '.' && (
              <button
                onClick={goUp}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <BackIcon />
                <span>..</span>
              </button>
            )}

            {/* File list */}
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => handleFileClick(file)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-800 text-left group"
              >
                {file.type === 'dir' ? <FolderIcon /> : <FileIcon />}
                <span className="flex-1 truncate">{file.name}</span>
                {file.type === 'file' && (
                  <span className={`text-xs ${copiedPath === file.path ? 'text-green-400' : 'text-zinc-500 opacity-0 group-hover:opacity-100'}`}>
                    {copiedPath === file.path ? 'Skopiowano!' : 'Kliknij = kopiuj'}
                  </span>
                )}
              </button>
            ))}

            {files.length === 0 && !isLoading && (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center">
                Brak plików w tym katalogu
              </div>
            )}
          </div>
        ) : (
          <pre className="p-3 text-xs text-zinc-300 font-mono whitespace-pre overflow-x-auto">
            {tree || 'Ładowanie struktury...'}
          </pre>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-zinc-800 border-t border-zinc-700 text-xs text-zinc-500">
        {view === 'list' ? (
          <span>Ścieżka: {currentPath}</span>
        ) : (
          <span>Kliknij na widok listy, aby nawigować i kopiować ścieżki</span>
        )}
      </div>
    </div>
  );
}

// Ikony SVG
function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
