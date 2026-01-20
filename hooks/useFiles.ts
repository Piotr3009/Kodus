// ========================================
// ZAMIEŃ CAŁY PLIK: hooks/useFiles.ts
// ========================================

/**
 * Hook do zarządzania plikami projektu
 * Umożliwia listowanie, czytanie i przeglądanie struktury plików
 * Obsługuje zarówno pliki lokalne jak i z GitHub
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

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

interface UseFilesState {
  files: FileInfo[];
  tree: string | null;
  currentPath: string;
  selectedFile: FileContent | null;
  isLoading: boolean;
  error: string | null;
  // Pola dla kontekstu projektu
  contextLoaded: boolean;
  projectContext: string | null;
  addedFiles: { path: string; content: string }[];
  // Info o połączonym repo
  repoInfo: RepoInfo | null;
}

export function useFiles() {
  const [state, setState] = useState<UseFilesState>({
    files: [],
    tree: null,
    currentPath: '',
    selectedFile: null,
    isLoading: false,
    error: null,
    contextLoaded: false,
    projectContext: null,
    addedFiles: [],
    repoInfo: null,
  });

  /**
   * Ustawia info o połączonym repo GitHub
   */
  const setRepoInfo = useCallback((repoInfo: RepoInfo | null) => {
    setState(prev => ({ 
      ...prev, 
      repoInfo,
      // Resetuj kontekst przy zmianie repo
      contextLoaded: false,
      projectContext: null,
      addedFiles: [],
      files: [],
      currentPath: '',
    }));
  }, []);

  /**
   * Buduje parametry URL dla zapytań API
   */
  const buildParams = useCallback((additionalParams: Record<string, string> = {}) => {
    const params = new URLSearchParams(additionalParams);
    
    if (state.repoInfo) {
      params.set('owner', state.repoInfo.owner);
      params.set('repo', state.repoInfo.repo);
      params.set('branch', state.repoInfo.branch);
    }
    
    return params;
  }, [state.repoInfo]);

  /**
   * Listuje pliki w danej ścieżce (z GitHub lub lokalnie)
   */
  const listFiles = useCallback(async (path: string = '') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = buildParams({ path });
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
  }, [buildParams]);

  /**
   * Czyta zawartość pliku
   */
  const readFile = useCallback(async (path: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = buildParams({ path });
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
  }, [buildParams]);

  /**
   * Pobiera drzewo struktury projektu
   */
  const getTree = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = buildParams();
      const response = await fetch(`/api/files/tree?${params}`);

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
  }, [buildParams]);

  /**
   * Nawiguje do katalogu nadrzędnego
   */
  const goUp = useCallback(async () => {
    if (state.currentPath === '' || state.currentPath === '.') {
      return;
    }

    const parentPath = state.currentPath.split('/').slice(0, -1).join('/') || '';
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
   * Ładuje pełny kontekst projektu dla AI (z GitHub lub lokalnie)
   */
  const loadProjectContext = useCallback(async (): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = buildParams();
      const response = await fetch(`/api/files/context?${params}`);

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
  }, [buildParams]);

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
      const body: Record<string, string> = { path };
      
      if (state.repoInfo) {
        body.owner = state.repoInfo.owner;
        body.repo = state.repoInfo.repo;
        body.branch = state.repoInfo.branch;
      }

      const response = await fetch('/api/files/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  }, [state.addedFiles, state.repoInfo]);

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
    contextLoaded: state.contextLoaded,
    projectContext: state.projectContext,
    addedFiles: state.addedFiles,
    repoInfo: state.repoInfo,

    // Actions
    setRepoInfo,
    listFiles,
    readFile,
    getTree,
    goUp,
    clearError,
    clearSelectedFile,
    loadProjectContext,
    addFileToContext,
    removeFileFromContext,
    clearContext,
    getFullContext,
  };
}