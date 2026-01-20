// ========================================
// ZAMIEŃ CAŁY PLIK: components/chat/ChatPanel.tsx
// ========================================

'use client';

/**
 * ChatPanel - główny panel chatu
 * Lista wiadomości, auto-scroll, input na dole
 */

import { useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ContextLoader } from './ContextLoader';
import { MessageSquare } from 'lucide-react';
import type { ChatMessage as ChatMessageType, ChatMode, AISender, AdditionalFile } from '@/lib/types';

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSend: (content: string, mode: ChatMode) => void;
  isLoading: boolean;
  currentlyTyping: AISender | null;
  typingQueue?: AISender[];
  onInsertCode?: (code: string, filename?: string, language?: string) => void;
  onOpenArtifact?: (code: string, filename?: string, language?: string) => void;
  defaultMode?: ChatMode;
  // Propsy dla kontekstu
  contextLoaded?: boolean;
  addedFiles?: AdditionalFile[];
  onLoadContext?: () => Promise<string | null>;
  onAddFile?: (path: string) => Promise<string | null>;
  onRemoveFile?: (path: string) => void;
  // Info o połączonym repo GitHub - akceptuje dowolny obiekt z owner/repo/branch
  repoInfo?: { owner: string; repo: string; branch: string } | null;
}

export function ChatPanel({
  messages,
  onSend,
  isLoading,
  currentlyTyping,
  typingQueue,
  onInsertCode,
  onOpenArtifact,
  defaultMode,
  // Propsy dla kontekstu
  contextLoaded = false,
  addedFiles = [],
  onLoadContext,
  onAddFile,
  onRemoveFile,
  // GitHub repo info
  repoInfo,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Scroll do dołu przy nowych wiadomościach (jeśli user nie scrollował w górę)
  useEffect(() => {
    if (!isUserScrolledUp.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentlyTyping]);

  // Wykryj czy user scrolluje w górę
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isUserScrolledUp.current = !isAtBottom;
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Context Loader - nad wiadomościami */}
      {onLoadContext && onAddFile && onRemoveFile && (
        <ContextLoader
          contextLoaded={contextLoaded}
          addedFiles={addedFiles}
          isLoading={isLoading}
          onLoadContext={onLoadContext}
          onAddFile={onAddFile}
          onRemoveFile={onRemoveFile}
          repoInfo={repoInfo}
        />
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-400 mb-2">
              Rozpocznij rozmowę
            </h3>
            <p className="text-sm text-zinc-500 max-w-md">
              Napisz czego potrzebujesz. Claude zaproponuje rozwiązanie,
              a w trybie Duo/Team GPT i Gemini dadzą feedback.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">
                🟣 Solo = tylko Claude
              </span>
              <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">
                🟣🟢 Duo = Claude + GPT
              </span>
              <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">
                🟣🟢🔵 Team = wszyscy
              </span>
            </div>
          </div>
        ) : (
          // Messages list
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onInsertCode={onInsertCode}
                onOpenArtifact={onOpenArtifact}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        currentlyTyping={currentlyTyping}
        typingQueue={typingQueue}
        defaultMode={defaultMode}
      />
    </div>
  );
}