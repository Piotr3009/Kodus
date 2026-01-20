/**
 * Główna strona Kodus - Chat Interface z Multi-AI Team
 * Layout: sidebar (konwersacje) + main (chat + editor)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bot, Menu, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

// Komponenty
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ConversationList } from '@/components/sidebar/ConversationList';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { ModeSelector } from '@/components/chat/ModeSelector';
import { Button } from '@/components/ui/button';
import { GitHubSync } from '@/components/github/GitHubSync';
import { ArtifactPanel } from '@/components/artifacts/ArtifactPanel';

// Hooks
import { useProjects } from '@/hooks/useProjects';
import { useChat } from '@/hooks/useChat';
import { useCodeEditor } from '@/hooks/useCodeEditor';
import { useGitHub } from '@/hooks/useGitHub';
import { useArtifacts } from '@/hooks/useArtifacts';
import { useFiles } from '@/hooks/useFiles';

// Typy i stałe
import type { ChatMode, Project } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function KodusChatPage() {
  // Stan UI
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileView, setMobileView] = useState<'chat' | 'editor'>('chat');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pobierz projekty
  const { state: projectsState } = useProjects();

  // Chat hook
  const chat = useChat({
    projectId: selectedProjectId || undefined,
    onError: (error) => toast.error(error),
  });

  // Code editor hook
  const editor = useCodeEditor();

  // GitHub hook
  const github = useGitHub();

  // Artifacts hook
  const artifacts = useArtifacts();

  // Files hook (dla kontekstu projektu)
  const files = useFiles();

  // Callback do ładowania kontekstu projektu
  const handleLoadContext = useCallback(async (): Promise<string | null> => {
    const context = await files.loadProjectContext();
    if (context) {
      chat.updateProjectContext(context);
    }
    return context;
  }, [files, chat]);

  // Callback do dodawania pliku do kontekstu
  const handleAddFile = useCallback(async (path: string): Promise<string | null> => {
    const content = await files.addFileToContext(path);
    if (content) {
      chat.addFile(path, content);
    }
    return content;
  }, [files, chat]);

  // Callback do usuwania pliku z kontekstu
  const handleRemoveFile = useCallback((path: string) => {
    files.removeFileFromContext(path);
    chat.removeFile(path);
  }, [files, chat]);

  // Callback do ładowania plików z GitHub do edytora
  const handleGitHubFilesLoaded = useCallback((files: any[]) => {
    // Dodaj pliki do edytora
    for (const file of files) {
      editor.insertCode(file.content, file.name, file.language);
    }
  }, [editor]);

  // Załaduj konwersacje przy starcie
  useEffect(() => {
    chat.loadConversations();
  }, []);

  // Wstaw kod z chatu do edytora
  const handleInsertCode = useCallback(
    (code: string, filename?: string, language?: string) => {
      editor.insertCode(code, filename, language);
      toast.success(`Kod wstawiony${filename ? ` do ${filename}` : ' do edytora'}`);
      // Na mobile - przełącz do widoku edytora
      setMobileView('editor');
    },
    [editor]
  );

  // Otwórz kod jako artefakt (panel boczny)
  const handleOpenArtifact = useCallback(
    (code: string, filename?: string, language?: string) => {
      const name = filename || `snippet-${Date.now()}.${language || 'txt'}`;
      const lang = language || 'typescript';
      artifacts.addArtifact(name, lang, code);
    },
    [artifacts]
  );

  // Obsługa skrótów klawiaturowych
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B = toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Ctrl+N = nowa rozmowa
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        chat.startNewConversation();
        toast.info('Nowa rozmowa');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chat]);

  // Filtruj konwersacje
  const filteredConversations = (chat as any).conversations?.filter(
    (c: any) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (!selectedProjectId || c.project_id === selectedProjectId)
  ) || [];

  // Wybrany projekt
  const selectedProject = projectsState.projects.find(
    (p) => p.id === selectedProjectId
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Overlay dla mobile gdy sidebar otwarty */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - lista konwersacji */}
      <aside
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-30 w-72 bg-zinc-900 border-r border-zinc-800',
          'transform transition-transform duration-200 ease-in-out flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0 lg:overflow-hidden'
        )}
      >
        {/* Header sidebar */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-500" />
            <span className="font-semibold text-sm">Kodus</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Lista konwersacji */}
        <ConversationList
          conversations={filteredConversations}
          selectedId={chat.conversationId}
          onSelect={(id) => {
            chat.loadConversation(id);
            setSidebarOpen(false);
          }}
          onNew={() => {
            chat.startNewConversation();
            setSidebarOpen(false);
          }}
          isLoading={false}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          {/* Left: menu + project */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Project selector */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
              >
                <span className="text-zinc-400">Projekt:</span>
                <span className="font-medium">
                  {selectedProject?.name || 'Wszystkie'}
                </span>
                <ChevronDown size={14} className="text-zinc-500" />
              </button>
              {/* TODO: Dropdown z projektami */}
            </div>
          </div>

          {/* Center: title (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-500" />
            <span className="font-semibold">Kodus Chat</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
              Multi-AI Team
            </span>
          </div>

          {/* Right: GitHub sync */}
          <div className="flex items-center gap-2">
            <GitHubSync
              github={github}
              files={editor.files}
              onFilesLoaded={handleGitHubFilesLoaded}
              onSuccess={(msg) => toast.success(msg)}
              onError={(msg) => toast.error(msg)}
            />
          </div>
        </header>

        {/* Mobile view tabs */}
        <div className="lg:hidden flex border-b border-zinc-800">
          <button
            onClick={() => setMobileView('chat')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              mobileView === 'chat'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-zinc-500 hover:text-white'
            )}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView('editor')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              mobileView === 'editor'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-zinc-500 hover:text-white'
            )}
          >
            Edytor
            {editor.hasUnsavedChanges && (
              <span className="ml-1 w-2 h-2 rounded-full bg-orange-500 inline-block" />
            )}
          </button>
        </div>

        {/* Main area - flex layout (desktop) / tabs (mobile) */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Desktop: flex layout with chat (60%) and editor (40%) */}
          <div className="hidden lg:flex lg:flex-col h-full">
            {/* Chat Panel - 60% */}
            <div className="flex-[6] min-h-0 overflow-hidden">
              <ChatPanel
                messages={chat.messages}
                onSend={chat.sendMessage}
                isLoading={chat.isLoading}
                currentlyTyping={chat.currentlyTyping}
                typingQueue={chat.typingQueue}
                onInsertCode={handleInsertCode}
                onOpenArtifact={handleOpenArtifact}
                contextLoaded={files.contextLoaded}
                addedFiles={files.addedFiles}
                onLoadContext={handleLoadContext}
                onAddFile={handleAddFile}
                onRemoveFile={handleRemoveFile}
              />
            </div>

            {/* Divider */}
            <div className="h-1 bg-zinc-800 flex-shrink-0" />

            {/* Code Editor - 40% */}
            <div className="flex-[4] min-h-0 overflow-hidden">
              <CodeEditor
                files={editor.files}
                activeFileId={editor.activeFile?.id || null}
                onFileSelect={editor.setActiveFile}
                onFileChange={editor.updateFileContent}
                onFileClose={editor.closeFile}
                onNewFile={editor.createFile}
                hasUnsavedChanges={editor.hasUnsavedChanges}
                onSave={() => {
                  (editor as any).markAllSaved?.();
                  toast.success('Zapisano!');
                }}
                onPush={async () => {
                  if (!github.isConnected) {
                    toast.info('Najpierw połącz się z GitHub');
                    return;
                  }
                  const success = await github.push(editor.files, 'Update from Kodus');
                  if (success) {
                    (editor as any).markAllSaved?.();
                    toast.success('Wysłano do GitHub!');
                  } else {
                    toast.error(github.error || 'Błąd wysyłania');
                  }
                }}
              />
            </div>
          </div>

          {/* Mobile: tabs */}
          <div className="lg:hidden h-full">
            {mobileView === 'chat' ? (
              <ChatPanel
                messages={chat.messages}
                onSend={chat.sendMessage}
                isLoading={chat.isLoading}
                currentlyTyping={chat.currentlyTyping}
                typingQueue={chat.typingQueue}
                onInsertCode={handleInsertCode}
                onOpenArtifact={handleOpenArtifact}
                contextLoaded={files.contextLoaded}
                addedFiles={files.addedFiles}
                onLoadContext={handleLoadContext}
                onAddFile={handleAddFile}
                onRemoveFile={handleRemoveFile}
              />
            ) : (
              <CodeEditor
                files={editor.files}
                activeFileId={editor.activeFile?.id || null}
                onFileSelect={editor.setActiveFile}
                onFileChange={editor.updateFileContent}
                onFileClose={editor.closeFile}
                onNewFile={editor.createFile}
                hasUnsavedChanges={editor.hasUnsavedChanges}
                onSave={() => {
                  (editor as any).markAllSaved?.();
                  toast.success('Zapisano!');
                }}
                onPush={async () => {
                  if (!github.isConnected) {
                    toast.info('Najpierw połącz się z GitHub');
                    return;
                  }
                  const success = await github.push(editor.files, 'Update from Kodus');
                  if (success) {
                    (editor as any).markAllSaved?.();
                    toast.success('Wysłano do GitHub!');
                  } else {
                    toast.error(github.error || 'Błąd wysyłania');
                  }
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* Panel artefaktów (wysuwany z prawej) */}
      <ArtifactPanel
        isOpen={artifacts.isOpen}
        artifacts={artifacts.artifacts}
        activeArtifact={artifacts.activeArtifact}
        onClose={artifacts.closePanel}
        onSelectArtifact={artifacts.setActiveArtifact}
        onRemoveArtifact={artifacts.removeArtifact}
        onInsertToEditor={handleInsertCode}
      />
    </div>
  );
}
