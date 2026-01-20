'use client';

/**
 * CodeEditor - edytowalny edytor kodu z Monaco
 * Obsługuje wiele plików, auto-detect języka
 */

import { useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { FileTabs } from './FileTabs';
import { Save, Upload, Plus, FileCode, FileArchive } from 'lucide-react';
import type { EditorFile } from '@/lib/types';
import { detectLanguage } from '@/lib/constants';
import { downloadAsZip } from '@/lib/download';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  files: EditorFile[];
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileChange: (id: string, content: string) => void;
  onFileClose: (id: string) => void;
  onNewFile: (name: string, language: string) => void;
  onSave?: () => void;
  onPush?: () => void;
  hasUnsavedChanges?: boolean;
}

export function CodeEditor({
  files,
  activeFileId,
  onFileSelect,
  onFileChange,
  onFileClose,
  onNewFile,
  onSave,
  onPush,
  hasUnsavedChanges,
}: CodeEditorProps) {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const activeFile = files.find((f) => f.id === activeFileId);

  // Obsługa zmiany w edytorze
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFileId && value !== undefined) {
        onFileChange(activeFileId, value);
      }
    },
    [activeFileId, onFileChange]
  );

  // Tworzenie nowego pliku
  const handleCreateFile = useCallback(() => {
    if (!newFileName.trim()) return;

    const ext = newFileName.split('.').pop() || 'ts';
    const language = detectLanguage('', newFileName);

    onNewFile(newFileName.trim(), language);
    setNewFileName('');
    setIsCreatingFile(false);
  }, [newFileName, onNewFile]);

  // Pobierz wszystkie pliki jako ZIP
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const handleDownloadZip = useCallback(async () => {
    if (files.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const zipFiles = files.map((f) => ({ name: f.name, content: f.content }));
      await downloadAsZip(zipFiles, 'kodus-project.zip');
    } catch (err) {
      console.error('Błąd pobierania ZIP:', err);
    } finally {
      setIsDownloadingZip(false);
    }
  }, [files]);

  // Dialog nowego pliku
  const NewFileDialog = () => (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
      <div className="bg-zinc-800 rounded-lg p-4 w-80">
        <h3 className="text-lg font-medium text-white mb-3">Nowy plik</h3>
        <input
          type="text"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="nazwa-pliku.tsx"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateFile();
            if (e.key === 'Escape') setIsCreatingFile(false);
          }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setIsCreatingFile(false)}
            className="px-3 py-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleCreateFile}
            disabled={!newFileName.trim()}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50 transition-colors"
          >
            Utwórz
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 border-t border-zinc-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-400">Edytor kodu</span>
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={onSave}
              disabled={!hasUnsavedChanges}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors',
                hasUnsavedChanges
                  ? 'text-orange-400 hover:bg-zinc-800'
                  : 'text-zinc-600 cursor-not-allowed'
              )}
              title="Zapisz"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Zapisz</span>
            </button>
          )}
          {onPush && (
            <button
              onClick={onPush}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Push to GitHub"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Push</span>
            </button>
          )}
          {/* Pobierz ZIP */}
          <button
            onClick={handleDownloadZip}
            disabled={files.length === 0 || isDownloadingZip}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors',
              files.length > 0
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-600 cursor-not-allowed'
            )}
            title="Pobierz wszystkie pliki jako ZIP"
          >
            <FileArchive size={14} />
            <span className="hidden sm:inline">
              {isDownloadingZip ? 'Pobieram...' : 'ZIP'}
            </span>
            {files.length > 0 && (
              <span className="text-xs text-zinc-500">({files.length})</span>
            )}
          </button>
        </div>
      </div>

      {/* File tabs */}
      <FileTabs
        files={files}
        activeFileId={activeFileId}
        onSelect={onFileSelect}
        onClose={onFileClose}
        onNew={() => setIsCreatingFile(true)}
      />

      {/* Editor or empty state */}
      <div className="flex-1 relative">
        {activeFile ? (
          <Editor
            height="100%"
            language={activeFile.language}
            value={activeFile.content}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              folding: true,
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
              <FileCode size={24} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-3">
              Brak otwartych plików
            </p>
            <button
              onClick={() => setIsCreatingFile(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
            >
              <Plus size={14} />
              Nowy plik
            </button>
          </div>
        )}

        {/* New file dialog */}
        {isCreatingFile && <NewFileDialog />}
      </div>
    </div>
  );
}
