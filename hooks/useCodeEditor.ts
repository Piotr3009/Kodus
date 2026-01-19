'use client';

/**
 * useCodeEditor - hook do zarządzania edytorem kodu
 * Obsługuje wiele plików, zmiany, tworzenie nowych plików
 */

import { useState, useCallback, useMemo } from 'react';
import { detectLanguage } from '@/lib/constants';
import type { EditorFile, UseCodeEditorReturn } from '@/lib/types';

// Generuje unikalne ID
function generateId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useCodeEditor(): UseCodeEditorReturn {
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Aktywny plik
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) || null,
    [files, activeFileId]
  );

  // Czy są niezapisane zmiany
  const hasUnsavedChanges = useMemo(
    () => files.some((f) => f.isDirty),
    [files]
  );

  // Ustaw aktywny plik
  const setActiveFile = useCallback((id: string) => {
    setActiveFileId(id);
  }, []);

  // Aktualizuj zawartość pliku
  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, content, isDirty: true } : f
      )
    );
  }, []);

  // Utwórz nowy plik
  const createFile = useCallback((name: string, language?: string) => {
    const id = generateId();
    const lang = language || detectLanguage('', name);

    const newFile: EditorFile = {
      id,
      name,
      language: lang,
      content: '',
      isDirty: false,
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(id);
  }, []);

  // Zamknij plik
  const closeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);

      // Jeśli zamknięto aktywny plik, wybierz inny
      if (id === activeFileId && filtered.length > 0) {
        const index = prev.findIndex((f) => f.id === id);
        const newIndex = Math.min(index, filtered.length - 1);
        setActiveFileId(filtered[newIndex]?.id || null);
      } else if (filtered.length === 0) {
        setActiveFileId(null);
      }

      return filtered;
    });
  }, [activeFileId]);

  // Wstaw kod do edytora (tworzy nowy plik lub aktualizuje aktywny)
  const insertCode = useCallback((code: string, filename?: string, providedLanguage?: string) => {
    // Użyj podanego języka lub wykryj automatycznie
    const language = providedLanguage || detectLanguage(code, filename);

    // Generuj rozszerzenie na podstawie języka
    const getExtension = (lang: string): string => {
      const extensions: Record<string, string> = {
        typescript: 'tsx',
        javascript: 'js',
        python: 'py',
        css: 'css',
        html: 'html',
        json: 'json',
        sql: 'sql',
        markdown: 'md',
        rust: 'rs',
        go: 'go',
      };
      return extensions[lang] || lang;
    };

    const name = filename || `code-${Date.now()}.${getExtension(language)}`;

    // Jeśli podano filename, sprawdź czy plik już istnieje
    if (filename) {
      const existingFile = files.find(f => f.name === filename);
      if (existingFile) {
        // Aktualizuj istniejący plik
        updateFileContent(existingFile.id, code);
        setActiveFileId(existingFile.id);
        return;
      }
    }

    // Jeśli jest aktywny plik i jest pusty, wstaw tam
    if (activeFile && !activeFile.content.trim()) {
      // Zaktualizuj również nazwę i język jeśli podano
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeFile.id
            ? { ...f, content: code, name: filename || f.name, language, isDirty: true }
            : f
        )
      );
      return;
    }

    // W przeciwnym razie stwórz nowy plik
    const id = generateId();
    const newFile: EditorFile = {
      id,
      name,
      language,
      content: code,
      isDirty: true,
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(id);
  }, [activeFile, files, updateFileContent]);

  // Oznacz plik jako zapisany
  const markFileSaved = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, isDirty: false } : f
      )
    );
  }, []);

  // Oznacz wszystkie jako zapisane
  const markAllSaved = useCallback(() => {
    setFiles((prev) =>
      prev.map((f) => ({ ...f, isDirty: false }))
    );
  }, []);

  return {
    files,
    activeFile,
    setActiveFile,
    updateFileContent,
    createFile,
    closeFile,
    hasUnsavedChanges,
    insertCode,
    markFileSaved,
    markAllSaved,
  } as UseCodeEditorReturn & {
    markFileSaved: (id: string) => void;
    markAllSaved: () => void;
  };
}
