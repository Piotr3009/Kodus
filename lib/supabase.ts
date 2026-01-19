/**
 * Klient Supabase dla AI Agent Dashboard
 * Połączenie z istniejącymi tabelami: projects, tasks, task_iterations, llm_responses
 * Storage bucket: artifacts
 */

import { createClient } from '@supabase/supabase-js';
import type {
  Project,
  Task,
  TaskIteration,
  LLMResponse,
  StorageFile,
  TaskFilters,
  Conversation,
  ChatMessage,
  ChatMode,
  MessageSender,
  Preference,
} from './types';
import { STORAGE_BUCKET, TASK_HISTORY_LIMIT } from './constants';

// Tworzenie klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Brak zmiennych środowiskowych Supabase. Ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// ============================================
// PROJEKTY
// ============================================

/**
 * Pobiera wszystkie projekty
 */
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Błąd pobierania projektów:', error);
    throw new Error(`Nie udało się pobrać projektów: ${error.message}`);
  }

  return data || [];
}

/**
 * Pobiera projekt po ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Nie znaleziono
    }
    console.error('Błąd pobierania projektu:', error);
    throw new Error(`Nie udało się pobrać projektu: ${error.message}`);
  }

  return data;
}

// ============================================
// ZADANIA
// ============================================

/**
 * Pobiera zadania z filtrami
 */
export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .order('created_at', { ascending: false })
    .limit(filters.limit || TASK_HISTORY_LIMIT);

  // Filtr po projekcie
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }

  // Filtr po statusie
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  // Wyszukiwanie tekstowe
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // Offset (paginacja)
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || TASK_HISTORY_LIMIT) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Błąd pobierania zadań:', error);
    throw new Error(`Nie udało się pobrać zadań: ${error.message}`);
  }

  return data || [];
}

/**
 * Pobiera zadanie po ID z pełnymi danymi
 */
export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Błąd pobierania zadania:', error);
    throw new Error(`Nie udało się pobrać zadania: ${error.message}`);
  }

  return data;
}

/**
 * Tworzy nowe zadanie
 */
export async function createTask(task: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title,
      description: task.description,
      project_id: task.project_id,
      status: 'pending',
      iteration_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Błąd tworzenia zadania:', error);
    throw new Error(`Nie udało się utworzyć zadania: ${error.message}`);
  }

  return data;
}

/**
 * Aktualizuje zadanie
 */
export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Błąd aktualizacji zadania:', error);
    throw new Error(`Nie udało się zaktualizować zadania: ${error.message}`);
  }

  return data;
}

// ============================================
// ITERACJE ZADAŃ
// ============================================

/**
 * Pobiera iteracje zadania
 */
export async function getTaskIterations(taskId: string): Promise<TaskIteration[]> {
  const { data, error } = await supabase
    .from('task_iterations')
    .select('*')
    .eq('task_id', taskId)
    .order('iteration_number', { ascending: true });

  if (error) {
    console.error('Błąd pobierania iteracji:', error);
    throw new Error(`Nie udało się pobrać iteracji: ${error.message}`);
  }

  return data || [];
}

// ============================================
// ODPOWIEDZI LLM
// ============================================

/**
 * Pobiera odpowiedzi LLM dla zadania
 */
export async function getLLMResponses(taskId: string): Promise<LLMResponse[]> {
  const { data, error } = await supabase
    .from('llm_responses')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Błąd pobierania odpowiedzi LLM:', error);
    throw new Error(`Nie udało się pobrać odpowiedzi LLM: ${error.message}`);
  }

  return data || [];
}

// ============================================
// STORAGE (PLIKI)
// ============================================

/**
 * Pobiera listę plików dla zadania
 */
export async function getTaskFiles(taskId: string): Promise<StorageFile[]> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(`tasks/${taskId}`, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    console.error('Błąd pobierania plików:', error);
    throw new Error(`Nie udało się pobrać plików: ${error.message}`);
  }

  // Mapuj na nasz typ StorageFile
  const files: StorageFile[] = (data || []).map((file) => ({
    name: file.name,
    size: file.metadata?.size || 0,
    type: file.metadata?.mimetype || 'application/octet-stream',
    path: `tasks/${taskId}/${file.name}`,
    created_at: file.created_at,
  }));

  return files;
}

/**
 * Pobiera URL do pobrania pliku
 */
export async function getFileDownloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 3600); // 1 godzina ważności

  if (error) {
    console.error('Błąd generowania URL:', error);
    throw new Error(`Nie udało się wygenerować URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Pobiera zawartość pliku jako Blob
 */
export async function downloadFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);

  if (error) {
    console.error('Błąd pobierania pliku:', error);
    throw new Error(`Nie udało się pobrać pliku: ${error.message}`);
  }

  return data;
}

/**
 * Wysyła plik do storage
 */
export async function uploadFile(
  taskId: string,
  fileName: string,
  file: File | Blob
): Promise<string> {
  const path = `tasks/${taskId}/${fileName}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.error('Błąd wysyłania pliku:', error);
    throw new Error(`Nie udało się wysłać pliku: ${error.message}`);
  }

  return path;
}

// ============================================
// SUBSKRYPCJE REAL-TIME (opcjonalne)
// ============================================

/**
 * Subskrybuje zmiany w zadaniu
 */
export function subscribeToTask(
  taskId: string,
  callback: (task: Task) => void
) {
  return supabase
    .channel(`task-${taskId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `id=eq.${taskId}`,
      },
      (payload) => {
        callback(payload.new as Task);
      }
    )
    .subscribe();
}

/**
 * Odsubskrybowuje kanał
 */
export async function unsubscribe(channel: ReturnType<typeof supabase.channel>) {
  await supabase.removeChannel(channel);
}

// ============================================
// KONWERSACJE CHAT
// ============================================

/**
 * Pobiera wszystkie konwersacje użytkownika
 */
export async function getConversations(projectId?: string): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Błąd pobierania konwersacji:', error);
    throw new Error(`Nie udało się pobrać konwersacji: ${error.message}`);
  }

  return data || [];
}

/**
 * Pobiera konwersację po ID
 */
export async function getConversationById(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Błąd pobierania konwersacji:', error);
    throw new Error(`Nie udało się pobrać konwersacji: ${error.message}`);
  }

  return data;
}

/**
 * Tworzy nową konwersację
 */
export async function createConversation(
  title: string,
  mode: ChatMode,
  projectId?: string
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      title,
      mode,
      project_id: projectId || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Błąd tworzenia konwersacji:', error);
    throw new Error(`Nie udało się utworzyć konwersacji: ${error.message}`);
  }

  return data;
}

/**
 * Aktualizuje konwersację
 */
export async function updateConversation(
  id: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Błąd aktualizacji konwersacji:', error);
    throw new Error(`Nie udało się zaktualizować konwersacji: ${error.message}`);
  }

  return data;
}

// ============================================
// WIADOMOŚCI CHAT
// ============================================

/**
 * Pobiera wiadomości dla konwersacji
 */
export async function getChatMessages(
  conversationId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Błąd pobierania wiadomości:', error);
    throw new Error(`Nie udało się pobrać wiadomości: ${error.message}`);
  }

  return data || [];
}

/**
 * Zapisuje wiadomość do bazy
 */
export async function saveChatMessage(
  conversationId: string,
  sender: MessageSender,
  content: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error('Błąd zapisywania wiadomości:', error);
    throw new Error(`Nie udało się zapisać wiadomości: ${error.message}`);
  }

  // Aktualizuj updated_at konwersacji
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
}

/**
 * Pobiera historię konwersacji dla AI (ostatnie N wiadomości)
 */
export async function getConversationHistory(
  conversationId: string,
  limit: number = 20
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Błąd pobierania historii:', error);
    return [];
  }

  // Odwróć kolejność żeby mieć chronologicznie
  return (data || []).reverse();
}

// ============================================
// PREFERENCJE UŻYTKOWNIKA
// ============================================

/**
 * Pobiera wszystkie preferencje użytkownika
 */
export async function getPreferences(): Promise<Preference[]> {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      // Jeśli tabela nie istnieje, zwróć pustą tablicę
      if (error.code === '42P01') {
        console.warn('Tabela preferences nie istnieje. Utwórz ją w Supabase.');
        return [];
      }
      console.error('Błąd pobierania preferencji:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania preferencji:', error);
    return [];
  }
}

/**
 * Zapisuje preferencję (upsert - aktualizuje jeśli istnieje)
 */
export async function savePreference(
  category: string,
  key: string,
  value: string
): Promise<void> {
  try {
    // Sprawdź czy preferencja już istnieje
    const { data: existing } = await supabase
      .from('preferences')
      .select('id')
      .eq('key', key)
      .single();

    if (existing) {
      // Aktualizuj istniejącą
      const { error } = await supabase
        .from('preferences')
        .update({
          category,
          value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Błąd aktualizacji preferencji:', error);
        throw new Error(`Nie udało się zaktualizować preferencji: ${error.message}`);
      }
    } else {
      // Utwórz nową
      const { error } = await supabase
        .from('preferences')
        .insert({
          category,
          key,
          value,
        });

      if (error) {
        console.error('Błąd zapisywania preferencji:', error);
        throw new Error(`Nie udało się zapisać preferencji: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Błąd zapisywania preferencji:', error);
    throw error;
  }
}

/**
 * Usuwa preferencję po kluczu
 */
export async function deletePreference(key: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('preferences')
      .delete()
      .eq('key', key);

    if (error) {
      console.error('Błąd usuwania preferencji:', error);
      throw new Error(`Nie udało się usunąć preferencji: ${error.message}`);
    }
  } catch (error) {
    console.error('Błąd usuwania preferencji:', error);
    throw error;
  }
}

/**
 * Pobiera preferencję po kluczu
 */
export async function getPreferenceByKey(key: string): Promise<Preference | null> {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Nie znaleziono
      }
      console.error('Błąd pobierania preferencji:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Błąd pobierania preferencji:', error);
    return null;
  }
}
