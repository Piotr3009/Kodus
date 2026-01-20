/**
 * Hook do zarządzania plikami projektu
 * Umożliwia listowanie, czytanie i przeglądanie struktury plików
 */

'use client';

import { useState, useCallback } from 'react';

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export interface FileContent {
  content: string;
  path: string;
  size: number;
}

interface UseFilesState {
  files: FileInfo[];
  tree: string | null;
  currentPath: string;
  selectedFile: FileContent | null;
  isLoading: boolean;
  error: string | null;
  // Nowe pola dla kontekstu projektu
  contextLoaded: boolean;
  projectContext: string | null;
  addedFiles: { path: string; content: string }[];
}

export function useFiles() {
  const [state, setState] = useState<UseFilesState>({
    files: [],
    tree: null,
    currentPath: '.',
    selectedFile: null,
    isLoading: false,
    error: null,
    // Nowe pola dla kontekstu projektu
    contextLoaded: false,
    projectContext: null,
    addedFiles: [],
  });

  /**
   * Listuje pliki w danej ścieżce
   */
  const listFiles = useCallback(async (path: string = '.') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({ path });
      const response = await fetch(`/api/files/list?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd pobierania listy plików');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        files: data.files,
        currentPath: path,
        isLoading: false,
      }));

      return data.files as FileInfo[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return [];
    }
  }, []);

  /**
   * Czyta zawartość pliku
   */
  const readFile = useCallback(async (path: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({ path });
      const response = await fetch(`/api/files/read?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd czytania pliku');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        selectedFile: data,
        isLoading: false,
      }));

      return data as FileContent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  /**
   * Pobiera drzewo struktury projektu
   */
  const getTree = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/files/tree');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd pobierania struktury projektu');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        tree: data.tree,
        isLoading: false,
      }));

      return data.tree as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  /**
   * Nawiguje do katalogu nadrzędnego
   */
  const goUp = useCallback(async () => {
    if (state.currentPath === '.' || state.currentPath === '') {
      return;
    }

    const parentPath = state.currentPath.split('/').slice(0, -1).join('/') || '.';
    await listFiles(parentPath);
  }, [state.currentPath, listFiles]);

  /**
   * Czyści błąd
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Czyści wybrany plik
   */
  const clearSelectedFile = useCallback(() => {
    setState(prev => ({ ...prev, selectedFile: null }));
  }, []);

  /**
   * Ładuje pełny kontekst projektu dla AI
   */
  const loadProjectContext = useCallback(async (): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/files/context');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd pobierania kontekstu projektu');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        projectContext: data.context,
        contextLoaded: true,
        isLoading: false,
      }));

      return data.context as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  /**
   * Dodaje pojedynczy plik do kontekstu AI
   */
  const addFileToContext = useCallback(async (path: string): Promise<string | null> => {
    // Sprawdź czy plik już jest dodany
    if (state.addedFiles.some(f => f.path === path)) {
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/files/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd pobierania pliku');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        addedFiles: [...prev.addedFiles, { path: data.path, content: data.content }],
        isLoading: false,
      }));

      return data.content as string;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, [state.addedFiles]);

  /**
   * Usuwa plik z kontekstu AI
   */
  const removeFileFromContext = useCallback((path: string) => {
    setState(prev => ({
      ...prev,
      addedFiles: prev.addedFiles.filter(f => f.path !== path),
    }));
  }, []);

  /**
   * Czyści cały kontekst projektu
   */
  const clearContext = useCallback(() => {
    setState(prev => ({
      ...prev,
      contextLoaded: false,
      projectContext: null,
      addedFiles: [],
    }));
  }, []);

  /**
   * Pobiera pełny kontekst do wysłania do AI
   */
  const getFullContext = useCallback((): string => {
    const parts: string[] = [];

    if (state.projectContext) {
      parts.push(state.projectContext);
    }

    if (state.addedFiles.length > 0) {
      parts.push('');
      parts.push('DODATKOWE PLIKI:');
      for (const file of state.addedFiles) {
        parts.push('');
        parts.push(file.content);
      }
    }

    return parts.join('\n');
  }, [state.projectContext, state.addedFiles]);

  return {
    // State
    files: state.files,
    tree: state.tree,
    currentPath: state.currentPath,
    selectedFile: state.selectedFile,
    isLoading: state.isLoading,
    error: state.error,
    // Nowe pola kontekstu
    contextLoaded: state.contextLoaded,
    projectContext: state.projectContext,
    addedFiles: state.addedFiles,

    // Actions
    listFiles,
    readFile,
    getTree,
    goUp,
    clearError,
    clearSelectedFile,
    // Nowe akcje kontekstu
    loadProjectContext,
    addFileToContext,
    removeFileFromContext,
    clearContext,
    getFullContext,
  };
}
