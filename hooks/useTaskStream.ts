/**
 * Hook do obsługi SSE (Server-Sent Events) dla real-time statusu zadania
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { StreamState, StreamEvent, StorageFile } from '@/lib/types';
import { API_ENDPOINTS, SSE_TIMEOUT } from '@/lib/constants';

interface UseTaskStreamOptions {
  onComplete?: (code: string, files: StorageFile[]) => void;
  onError?: (error: string) => void;
}

interface UseTaskStreamReturn {
  state: StreamState;
  connect: (taskId: string) => void;
  disconnect: () => void;
  reset: () => void;
}

const initialState: StreamState = {
  isConnected: false,
  status: 'idle',
  currentIteration: 0,
  maxIterations: 3,
  message: 'Oczekiwanie...',
  code: null,
  files: [],
  error: null,
  startTime: null,
  elapsedTime: 0,
};

export function useTaskStream(options: UseTaskStreamOptions = {}): UseTaskStreamReturn {
  const [state, setState] = useState<StreamState>(initialState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Aktualizacja czasu wykonania
  useEffect(() => {
    if (state.isConnected && state.startTime && state.status !== 'done' && state.status !== 'error') {
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedTime: Date.now() - (prev.startTime || Date.now()),
        }));
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.isConnected, state.startTime, state.status]);

  // Rozłączenie ze źródłem SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
    }));
  }, []);

  // Reset stanu
  const reset = useCallback(() => {
    disconnect();
    setState(initialState);
  }, [disconnect]);

  // Połączenie ze źródłem SSE
  const connect = useCallback(
    (taskId: string) => {
      // Najpierw rozłącz jeśli już połączony
      disconnect();

      // Ustaw stan początkowy połączenia
      setState({
        ...initialState,
        isConnected: true,
        startTime: Date.now(),
        status: 'idle',
        message: 'Łączenie...',
      });

      // Utwórz nowe połączenie SSE
      const url = `${API_ENDPOINTS.STREAM}?task_id=${encodeURIComponent(taskId)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Timeout dla całego zadania
      timeoutRef.current = setTimeout(() => {
        disconnect();
        const errorMessage = 'Przekroczono limit czasu wykonania zadania';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          message: errorMessage,
        }));
        options.onError?.(errorMessage);
      }, SSE_TIMEOUT);

      // Obsługa otwarcia połączenia
      eventSource.onopen = () => {
        setState((prev) => ({
          ...prev,
          message: 'Połączono, oczekiwanie na dane...',
        }));
      };

      // Obsługa wiadomości
      eventSource.onmessage = (event) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);

          setState((prev) => ({
            ...prev,
            status: data.status,
            currentIteration: data.iteration ?? prev.currentIteration,
            maxIterations: data.maxIterations ?? prev.maxIterations,
            message: data.message,
            code: data.code ?? prev.code,
            files: data.files ?? prev.files,
            error: data.error ?? null,
          }));

          // Sprawdź czy zakończono
          if (data.status === 'done') {
            disconnect();
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            options.onComplete?.(data.code || '', data.files || []);
          }

          // Sprawdź czy wystąpił błąd
          if (data.status === 'error') {
            disconnect();
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            options.onError?.(data.error || 'Nieznany błąd');
          }
        } catch (parseError) {
          console.error('Błąd parsowania SSE:', parseError);
        }
      };

      // Obsługa błędów
      eventSource.onerror = (error) => {
        console.error('Błąd SSE:', error);

        // Sprawdź czy to zamknięcie połączenia przez serwer
        if (eventSource.readyState === EventSource.CLOSED) {
          // Normalne zamknięcie, możliwe że zadanie zakończone
          return;
        }

        disconnect();
        const errorMessage = 'Utracono połączenie z serwerem';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          message: errorMessage,
        }));
        options.onError?.(errorMessage);
      };
    },
    [disconnect, options]
  );

  // Cleanup przy odmontowaniu
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    connect,
    disconnect,
    reset,
  };
}

export default useTaskStream;
