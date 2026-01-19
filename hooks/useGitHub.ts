'use client';

/**
 * useGitHub - hook do integracji z GitHub
 * Obsługuje połączenie z repo, pull i push plików
 */

import { useState, useCallback, useEffect } from 'react';
import type { EditorFile } from '@/lib/types';

// Stan synchronizacji
type SyncStatus = 'disconnected' | 'synced' | 'ahead' | 'behind' | 'error';

// Informacje o połączonym repo
interface RepoConnection {
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  fullName: string;
}

// Plik z GitHub (z SHA)
interface GitHubFileInfo {
  path: string;
  sha: string;
  content?: string;
}

// Zwracany typ hooka (rozszerzony)
export interface UseGitHubExtendedReturn {
  // Stan
  isConnected: boolean;
  isLoading: boolean;
  status: SyncStatus;
  error: string | null;
  repoInfo: RepoConnection | null;

  // Pliki z GitHub (z SHA do update)
  remoteFiles: GitHubFileInfo[];

  // Akcje
  connect: (repoUrl: string) => Promise<boolean>;
  disconnect: () => void;
  pull: () => Promise<EditorFile[]>;
  push: (files: EditorFile[], message: string) => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

// Klucz do localStorage
const STORAGE_KEY = 'kodus_github_connection';

/**
 * Wykrywa język na podstawie rozszerzenia pliku
 */
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
  };
  return languageMap[ext] || 'plaintext';
}

export function useGitHub(): UseGitHubExtendedReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoConnection | null>(null);
  const [remoteFiles, setRemoteFiles] = useState<GitHubFileInfo[]>([]);

  // Załaduj zapisane połączenie z localStorage przy starcie
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as RepoConnection;
        setRepoInfo(parsed);
        setIsConnected(true);
        setStatus('synced');
      }
    } catch {
      // Ignoruj błędy parsowania
    }
  }, []);

  /**
   * Połącz z repozytorium GitHub
   */
  const connect = useCallback(async (repoUrl: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', repoUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Nie udało się połączyć z repozytorium');
      }

      const connection: RepoConnection = {
        repoUrl,
        owner: data.repo.owner,
        repo: data.repo.repo,
        branch: data.repo.defaultBranch || 'main',
        fullName: data.repo.fullName,
      };

      setRepoInfo(connection);
      setIsConnected(true);
      setStatus('synced');

      // Zapisz do localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Błąd połączenia';
      setError(message);
      setStatus('error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Rozłącz z repozytorium
   */
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setRepoInfo(null);
    setRemoteFiles([]);
    setStatus('disconnected');
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Pobierz pliki z repozytorium (pull)
   */
  const pull = useCallback(async (): Promise<EditorFile[]> => {
    if (!repoInfo) {
      setError('Brak połączenia z repozytorium');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      // Pobierz drzewo plików
      const treeResponse = await fetch(
        `/api/github?repoUrl=${encodeURIComponent(repoInfo.repoUrl)}&action=tree`
      );
      const treeData = await treeResponse.json();

      if (!treeResponse.ok || !treeData.success) {
        throw new Error(treeData.error || 'Nie udało się pobrać listy plików');
      }

      // Filtruj tylko pliki tekstowe (bez binarnych, node_modules itp.)
      const textFiles = treeData.files.filter((file: { path: string }) => {
        const path = file.path.toLowerCase();
        // Ignoruj typowe katalogi i pliki binarne
        if (path.includes('node_modules/')) return false;
        if (path.includes('.git/')) return false;
        if (path.includes('dist/')) return false;
        if (path.includes('build/')) return false;
        if (path.includes('.next/')) return false;
        // Tylko znane rozszerzenia tekstowe
        const ext = path.split('.').pop() || '';
        const textExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'md', 'py', 'sql', 'yaml', 'yml', 'toml', 'env', 'txt'];
        return textExtensions.includes(ext);
      });

      // Pobierz zawartość plików (do 20 plików na raz)
      const filesToFetch = textFiles.slice(0, 20);
      const editorFiles: EditorFile[] = [];
      const newRemoteFiles: GitHubFileInfo[] = [];

      for (const file of filesToFetch) {
        try {
          const contentResponse = await fetch(
            `/api/github?repoUrl=${encodeURIComponent(repoInfo.repoUrl)}&action=file&path=${encodeURIComponent(file.path)}`
          );
          const contentData = await contentResponse.json();

          if (contentResponse.ok && contentData.success) {
            editorFiles.push({
              id: `github-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.path,
              language: detectLanguage(file.path),
              content: contentData.content,
              isDirty: false,
            });

            newRemoteFiles.push({
              path: file.path,
              sha: contentData.sha,
              content: contentData.content,
            });
          }
        } catch {
          // Ignoruj błędy pojedynczych plików
          console.warn(`Nie udało się pobrać: ${file.path}`);
        }
      }

      setRemoteFiles(newRemoteFiles);
      setStatus('synced');

      return editorFiles;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Błąd pobierania';
      setError(message);
      setStatus('error');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [repoInfo]);

  /**
   * Wyślij zmiany do repozytorium (push)
   */
  const push = useCallback(async (files: EditorFile[], message: string): Promise<boolean> => {
    if (!repoInfo) {
      setError('Brak połączenia z repozytorium');
      return false;
    }

    if (files.length === 0) {
      setError('Brak plików do wysłania');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Przygotuj pliki do wysłania
      const filesToPush = files.map(file => {
        // Znajdź SHA jeśli plik był wcześniej pobrany
        const remoteFile = remoteFiles.find(rf => rf.path === file.name);
        return {
          path: file.name,
          content: file.content,
          sha: remoteFile?.sha,
        };
      });

      const response = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoInfo.repoUrl,
          files: filesToPush,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się wysłać plików');
      }

      // Zaktualizuj SHA w remoteFiles
      if (data.results) {
        setRemoteFiles(prev => {
          const updated = [...prev];
          for (const result of data.results) {
            if (result.success && result.sha) {
              const index = updated.findIndex(f => f.path === result.path);
              if (index >= 0) {
                updated[index] = { ...updated[index], sha: result.sha };
              } else {
                updated.push({ path: result.path, sha: result.sha });
              }
            }
          }
          return updated;
        });
      }

      setStatus('synced');
      return data.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Błąd wysyłania';
      setError(errorMessage);
      setStatus('error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [repoInfo, remoteFiles]);

  /**
   * Odśwież status synchronizacji
   */
  const refreshStatus = useCallback(async () => {
    if (!repoInfo) {
      setStatus('disconnected');
      return;
    }

    // Na razie tylko sprawdzamy połączenie
    try {
      const response = await fetch(
        `/api/github?repoUrl=${encodeURIComponent(repoInfo.repoUrl)}&action=info`
      );

      if (response.ok) {
        setStatus('synced');
        setError(null);
      } else {
        setStatus('error');
        setError('Utracono połączenie z repozytorium');
      }
    } catch {
      setStatus('error');
      setError('Nie można sprawdzić statusu');
    }
  }, [repoInfo]);

  return {
    isConnected,
    isLoading,
    status,
    error,
    repoInfo,
    remoteFiles,
    connect,
    disconnect,
    pull,
    push,
    refreshStatus,
  };
}
