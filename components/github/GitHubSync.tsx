'use client';

/**
 * GitHubSync - komponent do synchronizacji z GitHub
 * Wyświetla status połączenia, przyciski Pull/Push, formularz commit message
 */

import { useState, useCallback } from 'react';
import {
  Github,
  RefreshCw,
  Download,
  Upload,
  Check,
  AlertCircle,
  X,
  Link,
  Unlink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EditorFile } from '@/lib/types';
import type { UseGitHubExtendedReturn } from '@/hooks/useGitHub';

interface GitHubSyncProps {
  github: UseGitHubExtendedReturn;
  files: EditorFile[];
  onFilesLoaded?: (files: EditorFile[]) => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

// Badge statusu synchronizacji
function StatusBadge({ status }: { status: UseGitHubExtendedReturn['status'] }) {
  const statusConfig = {
    disconnected: { label: 'Rozłączony', color: 'bg-zinc-600', icon: Unlink },
    synced: { label: 'Zsynchronizowany', color: 'bg-green-600', icon: Check },
    ahead: { label: 'Lokalne zmiany', color: 'bg-yellow-600', icon: Upload },
    behind: { label: 'Dostępne aktualizacje', color: 'bg-blue-600', icon: Download },
    error: { label: 'Błąd', color: 'bg-red-600', icon: AlertCircle },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white',
        config.color
      )}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}

export function GitHubSync({
  github,
  files,
  onFilesLoaded,
  onSuccess,
  onError,
}: GitHubSyncProps) {
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);

  const {
    isConnected,
    isLoading,
    status,
    error,
    repoInfo,
    connect,
    disconnect,
    pull,
    push,
  } = github;

  // Obsłuż połączenie z repozytorium
  const handleConnect = useCallback(async () => {
    if (!repoUrlInput.trim()) {
      onError?.('Podaj URL repozytorium');
      return;
    }

    const success = await connect(repoUrlInput);
    if (success) {
      setShowConnectDialog(false);
      setRepoUrlInput('');
      onSuccess?.('Połączono z repozytorium');
    } else {
      onError?.(github.error || 'Nie udało się połączyć');
    }
  }, [repoUrlInput, connect, github.error, onSuccess, onError]);

  // Obsłuż pull
  const handlePull = useCallback(async () => {
    const loadedFiles = await pull();
    if (loadedFiles.length > 0) {
      onFilesLoaded?.(loadedFiles);
      onSuccess?.(`Pobrano ${loadedFiles.length} plików`);
    } else if (github.error) {
      onError?.(github.error);
    } else {
      onError?.('Brak plików do pobrania');
    }
  }, [pull, github.error, onFilesLoaded, onSuccess, onError]);

  // Obsłuż push
  const handlePush = useCallback(async () => {
    if (!commitMessage.trim()) {
      onError?.('Podaj commit message');
      return;
    }

    // Filtruj pliki z isDirty lub wszystkie jeśli chcesz
    const filesToPush = files.filter(f => f.isDirty || f.content.trim());

    if (filesToPush.length === 0) {
      onError?.('Brak plików do wysłania');
      return;
    }

    const success = await push(filesToPush, commitMessage);
    if (success) {
      setShowPushDialog(false);
      setCommitMessage('');
      onSuccess?.(`Wysłano ${filesToPush.length} plików`);
    } else {
      onError?.(github.error || 'Nie udało się wysłać');
    }
  }, [files, commitMessage, push, github.error, onSuccess, onError]);

  // Obsłuż rozłączenie
  const handleDisconnect = useCallback(() => {
    disconnect();
    onSuccess?.('Rozłączono z repozytorium');
  }, [disconnect, onSuccess]);

  // Widok gdy nie połączony
  if (!isConnected) {
    return (
      <div className="relative">
        {/* Przycisk połączenia */}
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-white"
          onClick={() => setShowConnectDialog(true)}
        >
          <Github className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Połącz z GitHub</span>
        </Button>

        {/* Dialog połączenia */}
        {showConnectDialog && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Github size={18} />
                Połącz z GitHub
              </h3>
              <button
                onClick={() => setShowConnectDialog(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  URL repozytorium
                </label>
                <input
                  type="text"
                  value={repoUrlInput}
                  onChange={(e) => setRepoUrlInput(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {error}
                </p>
              )}

              <Button
                onClick={handleConnect}
                disabled={isLoading || !repoUrlInput.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Połącz
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Widok gdy połączony
  return (
    <div className="flex items-center gap-2">
      {/* Status badge */}
      <StatusBadge status={status} />

      {/* Nazwa repo */}
      <span className="text-xs text-zinc-400 hidden md:inline truncate max-w-32">
        {repoInfo?.fullName}
      </span>

      {/* Przyciski akcji */}
      <div className="flex items-center gap-1">
        {/* Pull */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handlePull}
          disabled={isLoading}
          title="Pobierz z GitHub (Pull)"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>

        {/* Push */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowPushDialog(true)}
          disabled={isLoading || files.length === 0}
          title="Wyślij do GitHub (Push)"
        >
          <Upload className="h-4 w-4" />
        </Button>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => github.refreshStatus()}
          disabled={isLoading}
          title="Odśwież status"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>

        {/* Disconnect */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-red-400"
          onClick={handleDisconnect}
          title="Rozłącz"
        >
          <Unlink className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialog push */}
      {showPushDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-md mx-4 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white flex items-center gap-2">
                <Upload size={18} />
                Push do GitHub
              </h3>
              <button
                onClick={() => setShowPushDialog(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Lista plików */}
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">
                  Pliki do wysłania ({files.filter(f => f.isDirty || f.content.trim()).length})
                </label>
                <div className="max-h-32 overflow-y-auto bg-zinc-800 rounded-lg p-2">
                  {files.filter(f => f.isDirty || f.content.trim()).map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 text-sm text-zinc-300 py-1"
                    >
                      <span className={cn(
                        'w-2 h-2 rounded-full',
                        file.isDirty ? 'bg-yellow-500' : 'bg-green-500'
                      )} />
                      <span className="truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commit message */}
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  Commit message
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Opisz zmiany..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => e.key === 'Enter' && handlePush()}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPushDialog(false)}
                  className="flex-1"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={handlePush}
                  disabled={isLoading || !commitMessage.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Push
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
