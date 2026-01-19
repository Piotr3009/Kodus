'use client';

/**
 * ChatInput - pole wprowadzania wiadomości
 * Auto-resize textarea, wybór trybu, Ctrl+Enter do wysłania
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { ModeSelector } from './ModeSelector';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMode, AISender } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string, mode: ChatMode) => void;
  isLoading: boolean;
  currentlyTyping: AISender | null;
  typingQueue?: AISender[];
  defaultMode?: ChatMode;
}

export function ChatInput({
  onSend,
  isLoading,
  currentlyTyping,
  typingQueue = [],
  defaultMode = 'solo',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<ChatMode>(defaultMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Załaduj preferowany tryb z localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kodus-chat-mode');
    if (saved && ['solo', 'duo', 'team'].includes(saved)) {
      setMode(saved as ChatMode);
    }
  }, []);

  // Zapisz tryb do localStorage przy zmianie
  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    localStorage.setItem('kodus-chat-mode', newMode);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Obsługa wysyłania
  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    onSend(trimmed, mode);
    setMessage('');

    // Reset wysokości textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, mode, isLoading, onSend]);

  // Obsługa klawiszy
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
      {/* Typing indicator */}
      {currentlyTyping && (
        <div className="px-4 pt-3">
          <TypingIndicator sender={currentlyTyping} queue={typingQueue} />
        </div>
      )}

      {/* Input area */}
      <div className="p-4 space-y-3">
        {/* Mode selector */}
        <div className="flex items-center justify-between">
          <ModeSelector mode={mode} onChange={handleModeChange} disabled={isLoading} size="sm" />
          <span className="text-xs text-zinc-500">Ctrl+Enter aby wysłać</span>
        </div>

        {/* Textarea + Send button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Napisz wiadomość... (np. 'Napisz komponent przycisk' lub 'ok robimy')"
              disabled={isLoading}
              rows={1}
              className={cn(
                'w-full px-4 py-3 rounded-lg resize-none',
                'bg-zinc-800 border border-zinc-700',
                'text-white placeholder-zinc-500',
                'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all'
              )}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className={cn(
              'flex-shrink-0 px-4 py-3 rounded-lg',
              'bg-purple-600 hover:bg-purple-700',
              'text-white font-medium',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
              'flex items-center justify-center'
            )}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
