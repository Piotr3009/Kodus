/**
 * API Route: /api/stream
 * SSE (Server-Sent Events) endpoint dla real-time statusu zadania
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { StreamEvent, Task, TaskIteration } from '@/lib/types';

// Zmienne środowiskowe
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Inicjalizacja klienta Supabase
const getSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Brak konfiguracji Supabase');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
};

// Interwały sprawdzania (ms)
const POLL_INTERVAL = 2000; // 2 sekundy
const HEARTBEAT_INTERVAL = 15000; // 15 sekund
const MAX_DURATION = 5 * 60 * 1000; // 5 minut

// Helper do wysyłania SSE event
const sendEvent = (
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: StreamEvent
) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(encoder.encode(data));
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const taskId = searchParams.get('task_id');

  // Walidacja
  if (!taskId) {
    return new Response('Brak parametru task_id', { status: 400 });
  }

  // Sprawdź konfigurację Supabase
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response('Brak konfiguracji Supabase', { status: 500 });
  }

  const encoder = new TextEncoder();
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const supabase = getSupabaseClient();
      const startTime = Date.now();
      let lastStatus: string | null = null;
      let lastIterationCount = 0;

      // Funkcja sprawdzająca status zadania
      const checkTaskStatus = async () => {
        if (!isActive) return;

        try {
          // Pobierz aktualne dane zadania
          const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();

          if (taskError) {
            // Zadanie nie istnieje lub błąd
            if (taskError.code === 'PGRST116') {
              sendEvent(controller, encoder, {
                status: 'error',
                message: 'Zadanie nie zostało znalezione',
                error: 'NOT_FOUND',
              });
            } else {
              sendEvent(controller, encoder, {
                status: 'error',
                message: 'Błąd pobierania zadania',
                error: taskError.message,
              });
            }
            isActive = false;
            controller.close();
            return;
          }

          const typedTask = task as Task;

          // Pobierz ostatnią iterację
          const { data: iterations } = await supabase
            .from('task_iterations')
            .select('*')
            .eq('task_id', taskId)
            .order('iteration_number', { ascending: false })
            .limit(1);

          const lastIteration = iterations?.[0] as TaskIteration | undefined;

          // Określ aktualny status na podstawie danych
          let streamStatus: StreamEvent['status'] = 'idle';
          let message = 'Oczekiwanie...';
          let currentIteration = typedTask.iteration_count || 1;

          switch (typedTask.status) {
            case 'pending':
              streamStatus = 'idle';
              message = 'Zadanie w kolejce...';
              break;

            case 'in_progress':
              // Określ na podstawie iteracji i feedbacku
              if (lastIteration) {
                currentIteration = lastIteration.iteration_number;

                if (!lastIteration.claude_code) {
                  // Claude jeszcze nie napisał kodu
                  streamStatus = currentIteration > 1 ? 'claude_fixing' : 'claude_working';
                  message = currentIteration > 1
                    ? `Claude poprawia kod... (iteracja ${currentIteration}/3)`
                    : 'Claude pisze kod...';
                } else if (!lastIteration.gpt_feedback) {
                  // Czeka na GPT
                  streamStatus = 'gpt_review';
                  message = `GPT sprawdza kod... (iteracja ${currentIteration}/3)`;
                } else if (!lastIteration.gemini_feedback) {
                  // Czeka na Gemini
                  streamStatus = 'gemini_review';
                  message = `Gemini sprawdza UI... (iteracja ${currentIteration}/3)`;
                } else {
                  // Wszystkie feedbacki są, może być kolejna iteracja
                  streamStatus = 'claude_fixing';
                  message = `Przygotowanie następnej iteracji...`;
                }
              } else {
                // Brak iteracji, Claude zaczyna
                streamStatus = 'claude_working';
                message = 'Claude pisze kod...';
              }
              break;

            case 'completed':
              streamStatus = 'done';
              message = 'Zakończono pomyślnie';
              break;

            case 'failed':
              streamStatus = 'error';
              message = 'Zadanie zakończyło się błędem';
              break;
          }

          // Wyślij event tylko jeśli coś się zmieniło
          if (streamStatus !== lastStatus || currentIteration !== lastIterationCount) {
            const event: StreamEvent = {
              status: streamStatus,
              iteration: currentIteration,
              maxIterations: 3,
              message,
              timestamp: new Date().toISOString(),
            };

            // Dodaj kod jeśli zadanie zakończone
            if (streamStatus === 'done' && typedTask.final_code) {
              event.code = typedTask.final_code;

              // Pobierz pliki z Storage
              try {
                const { data: files } = await supabase.storage
                  .from('artifacts')
                  .list(`tasks/${taskId}`);

                if (files && files.length > 0) {
                  event.files = files.map((f) => ({
                    name: f.name,
                    size: f.metadata?.size || 0,
                    type: f.metadata?.mimetype || 'application/octet-stream',
                    path: `tasks/${taskId}/${f.name}`,
                  }));
                }
              } catch {
                // Ignoruj błędy pobierania plików
              }
            }

            // Dodaj błąd jeśli wystąpił
            if (streamStatus === 'error') {
              event.error = 'Task failed';
            }

            sendEvent(controller, encoder, event);

            lastStatus = streamStatus;
            lastIterationCount = currentIteration;
          }

          // Zamknij stream jeśli zadanie zakończone
          if (streamStatus === 'done' || streamStatus === 'error') {
            isActive = false;
            controller.close();
            return;
          }

          // Sprawdź timeout
          if (Date.now() - startTime > MAX_DURATION) {
            sendEvent(controller, encoder, {
              status: 'error',
              message: 'Przekroczono limit czasu',
              error: 'TIMEOUT',
            });
            isActive = false;
            controller.close();
            return;
          }

          // Zaplanuj kolejne sprawdzenie
          if (isActive) {
            setTimeout(checkTaskStatus, POLL_INTERVAL);
          }
        } catch (error) {
          console.error('Błąd SSE:', error);

          if (isActive) {
            sendEvent(controller, encoder, {
              status: 'error',
              message: 'Błąd wewnętrzny',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            isActive = false;
            controller.close();
          }
        }
      };

      // Heartbeat aby utrzymać połączenie
      const heartbeat = setInterval(() => {
        if (isActive) {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch {
            clearInterval(heartbeat);
          }
        } else {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL);

      // Rozpocznij sprawdzanie
      checkTaskStatus();
    },

    cancel() {
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Dla nginx
    },
  });
}
