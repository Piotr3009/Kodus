'use client';

/**
 * useChat - hook do zarządzania stanem chatu
 * Obsługuje SSE, historię wiadomości, ładowanie konwersacji
 */

import { useState, useCallback, useRef } from 'react';
import { getChatMessages, getConversations } from '@/lib/supabase';
import { CHAT_API_ENDPOINTS } from '@/lib/constants';
import type {
  ChatMessage,
  ChatMode,
  AISender,
  Conversation,
  ChatStreamEvent,
  UseChatReturn,
} from '@/lib/types';

interface AdditionalFile {
  path: string;
  content: string;
}

interface UseChatOptions {
  projectId?: string;
  onMessageReceived?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { projectId, onMessageReceived, onError } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentlyTyping, setCurrentlyTyping] = useState<AISender | null>(null);
  const [typingQueue, setTypingQueue] = useState<AISender[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Nowe stany dla kontekstu projektu
  const [projectContext, setProjectContext] = useState<string | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<AdditionalFile[]>([]);

  // Ref do EventSource
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ładowanie listy konwersacji
  const loadConversations = useCallback(async () => {
    try {
      const convos = await getConversations(projectId);
      setConversations(convos);
    } catch (err) {
      console.error('Błąd ładowania konwersacji:', err);
    }
  }, [projectId]);

  // Ładowanie konkretnej konwersacji
  const loadConversation = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const msgs = await getChatMessages(id);
      setMessages(msgs);
      setConversationId(id);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Błąd ładowania rozmowy';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Rozpocznij nową konwersację
  const startNewConversation = useCallback(() => {
    // Anuluj poprzednie połączenie
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setMessages([]);
    setConversationId(null);
    setCurrentlyTyping(null);
    setTypingQueue([]);
    setError(null);
  }, []);

  // Wysyłanie wiadomości
  const sendMessage = useCallback(async (content: string, mode: ChatMode) => {
    try {
      setIsLoading(true);
      setError(null);

      // Dodaj wiadomość użytkownika do UI natychmiast
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId || 'new',
        sender: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Utwórz abort controller
      abortControllerRef.current = new AbortController();

      // Przygotuj pełny kontekst projektu
      let fullProjectContext: string | undefined;
      if (projectContext || additionalFiles.length > 0) {
        const contextParts: string[] = [];
        if (projectContext) {
          contextParts.push(projectContext);
        }
        if (additionalFiles.length > 0) {
          contextParts.push('');
          contextParts.push('DODATKOWE PLIKI:');
          for (const file of additionalFiles) {
            contextParts.push('');
            contextParts.push(file.content);
          }
        }
        fullProjectContext = contextParts.join('\n');
      }

      // Wyślij request do API
      const response = await fetch(CHAT_API_ENDPOINTS.CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: content,
          mode,
          project_id: projectId,
          projectContext: fullProjectContext,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      // Obsługa SSE
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Brak response body');

      const decoder = new TextDecoder();
      let buffer = '';

      // Określ kolejkę typowania na podstawie mode
      const getTypingQueue = (mode: ChatMode, current: AISender): AISender[] => {
        const queues: Record<ChatMode, AISender[]> = {
          solo: [],
          duo: current === 'claude' ? ['gpt', 'claude'] : ['claude'],
          team: current === 'claude'
            ? ['gpt', 'gemini', 'claude']
            : current === 'gpt'
              ? ['gemini', 'claude']
              : ['claude'],
        };
        return queues[mode].filter((a) => a !== current);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parsuj SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: ChatStreamEvent = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'conversation_id':
                  if (event.id) {
                    setConversationId(event.id);
                    // Aktualizuj tymczasową wiadomość
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id.startsWith('temp-') ? { ...m, conversation_id: event.id! } : m
                      )
                    );
                  }
                  break;

                case 'typing':
                  if (event.sender && event.sender !== 'user') {
                    setCurrentlyTyping(event.sender as AISender);
                    setTypingQueue(getTypingQueue(mode, event.sender as AISender));
                  }
                  break;

                case 'message':
                  if (event.sender && event.content) {
                    const newMessage: ChatMessage = {
                      id: `msg-${Date.now()}-${event.sender}`,
                      conversation_id: conversationId || 'new',
                      sender: event.sender,
                      content: event.content,
                      created_at: new Date().toISOString(),
                    };
                    setMessages((prev) => [...prev, newMessage]);
                    onMessageReceived?.(newMessage);
                    setCurrentlyTyping(null);
                  }
                  break;

                case 'done':
                  setCurrentlyTyping(null);
                  setTypingQueue([]);
                  setIsLoading(false);
                  // Odśwież listę konwersacji
                  loadConversations();
                  break;

                case 'error':
                  const errorMsg = event.error || 'Nieznany błąd';
                  setError(errorMsg);
                  onError?.(errorMsg);
                  setCurrentlyTyping(null);
                  setTypingQueue([]);
                  setIsLoading(false);
                  break;
              }
            } catch {
              // Ignoruj błędy parsowania
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Anulowano - ignoruj
        return;
      }
      const errorMsg = err instanceof Error ? err.message : 'Błąd wysyłania wiadomości';
      setError(errorMsg);
      onError?.(errorMsg);
      setCurrentlyTyping(null);
      setTypingQueue([]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, projectId, projectContext, additionalFiles, onMessageReceived, onError, loadConversations]);

  // Metody do zarządzania kontekstem projektu
  const updateProjectContext = useCallback((context: string | null) => {
    setProjectContext(context);
  }, []);

  const addFile = useCallback((path: string, content: string) => {
    setAdditionalFiles(prev => {
      // Nie dodawaj duplikatów
      if (prev.some(f => f.path === path)) {
        return prev;
      }
      return [...prev, { path, content }];
    });
  }, []);

  const removeFile = useCallback((path: string) => {
    setAdditionalFiles(prev => prev.filter(f => f.path !== path));
  }, []);

  const clearProjectContext = useCallback(() => {
    setProjectContext(null);
    setAdditionalFiles([]);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    currentlyTyping,
    typingQueue,
    startNewConversation,
    loadConversation,
    conversationId,
    error,
    conversations,
    loadConversations,
    // Nowe pola dla kontekstu projektu
    projectContext,
    additionalFiles,
    updateProjectContext,
    addFile,
    removeFile,
    clearProjectContext,
  };
}
