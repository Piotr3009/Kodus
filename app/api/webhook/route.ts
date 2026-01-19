/**
 * API Route: /api/webhook
 * Proxy do N8N webhook - wysyła zadanie do przetworzenia przez multi-LLM pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { WebhookRequest, WebhookResponse, Project, Task } from '@/lib/types';

// Zmienne środowiskowe
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Inicjalizacja klienta Supabase po stronie serwera
const getSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Brak konfiguracji Supabase');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
};

export async function POST(request: NextRequest) {
  try {
    // Sprawdź konfigurację
    if (!N8N_WEBHOOK_URL) {
      return NextResponse.json(
        { error: 'Brak konfiguracji N8N webhook URL' },
        { status: 500 }
      );
    }

    // Parsuj request body
    const body = await request.json();
    const { task, project_id, mode } = body as WebhookRequest;

    // Walidacja
    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      return NextResponse.json(
        { error: 'Zadanie jest wymagane' },
        { status: 400 }
      );
    }

    // Pobierz kontekst z Supabase
    // Używamy Partial<Task> dla recent_tasks bo pobieramy tylko wybrane pola
    let context: { project?: Project; recent_tasks?: Partial<Task>[] } = {};

    try {
      const supabase = getSupabaseClient();

      // Pobierz dane projektu (jeśli wybrano)
      if (project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('*')
          .eq('id', project_id)
          .single();

        if (project) {
          context.project = project as Project;
        }
      }

      // Pobierz ostatnie zadania dla kontekstu (tylko podstawowe pola)
      let taskQuery = supabase
        .from('tasks')
        .select('id, title, description, status')
        .order('created_at', { ascending: false })
        .limit(5);

      if (project_id) {
        taskQuery = taskQuery.eq('project_id', project_id);
      }

      const { data: recentTasks } = await taskQuery;

      if (recentTasks && recentTasks.length > 0) {
        context.recent_tasks = recentTasks as Partial<Task>[];
      }
    } catch (contextError) {
      console.warn('Nie udało się pobrać kontekstu:', contextError);
      // Kontynuuj bez kontekstu
    }

    // Utwórz nowe zadanie w bazie
    let taskId: string;

    try {
      const supabase = getSupabaseClient();

      const { data: newTask, error: insertError } = await supabase
        .from('tasks')
        .insert({
          title: task.substring(0, 100), // Pierwsze 100 znaków jako tytuł
          description: task,
          project_id: project_id || null,
          status: 'pending',
          iteration_count: 0,
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      taskId = newTask.id;
    } catch (dbError) {
      console.error('Błąd zapisu do bazy:', dbError);
      // Wygeneruj tymczasowe ID jeśli baza nie działa
      taskId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Przygotuj payload dla N8N
    const webhookPayload = {
      task_id: taskId,
      task: task.trim(),
      project_id: project_id || null,
      mode: mode || 'full',
      context,
      timestamp: new Date().toISOString(),
    };

    // Wyślij do N8N webhook
    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_WEBHOOK_SECRET && {
          Authorization: `Bearer ${N8N_WEBHOOK_SECRET}`,
          'X-Webhook-Secret': N8N_WEBHOOK_SECRET,
        }),
      },
      body: JSON.stringify(webhookPayload),
    });

    // Sprawdź odpowiedź z N8N
    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Błąd N8N webhook:', errorText);

      // Oznacz zadanie jako failed
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('tasks')
          .update({ status: 'failed' })
          .eq('id', taskId);
      } catch {
        // Ignoruj błędy aktualizacji
      }

      return NextResponse.json(
        { error: 'Błąd komunikacji z N8N', details: errorText },
        { status: 502 }
      );
    }

    // Parsuj odpowiedź z N8N
    let n8nData;
    try {
      n8nData = await webhookResponse.json();
    } catch {
      // N8N może zwrócić pustą odpowiedź przy pomyślnym przyjęciu
      n8nData = {};
    }

    // Oznacz zadanie jako in_progress
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);
    } catch {
      // Ignoruj błędy aktualizacji
    }

    // Zwróć odpowiedź
    const response: WebhookResponse = {
      task_id: taskId,
      stream_url: `/api/stream?task_id=${taskId}`,
      ...n8nData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Błąd webhook:', error);

    return NextResponse.json(
      {
        error: 'Wewnętrzny błąd serwera',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Opcjonalnie: GET do sprawdzenia statusu endpointu
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhook',
    method: 'POST',
    configured: !!N8N_WEBHOOK_URL,
  });
}
