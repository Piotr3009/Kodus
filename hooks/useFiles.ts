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
}

export function useFiles() {
  const [state, setState] = useState<UseFilesState>({
    files: [],
    tree: null,
    currentPath: '.',
    selectedFile: null,
    isLoading: false,
    error: null,
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

  return {
    // State
    files: state.files,
    tree: state.tree,
    currentPath: state.currentPath,
    selectedFile: state.selectedFile,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    listFiles,
    readFile,
    getTree,
    goUp,
    clearError,
    clearSelectedFile,
  };
}
