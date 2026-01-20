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
  // Nowe typy dla auto-save
  Decision,
  BugHistory,
  Prompt,
  ProjectRule,
  TechStackItem,
  StyleGuide,
  UserFeedback,
  ReviewFeedback,
  BacklogItem,
  Doc,
  Milestone,
  MemoryEmbedding,
  // Inputy
  SaveLLMResponseInput,
  SaveDecisionInput,
  SaveBugInput,
  SavePromptInput,
  SaveProjectRuleInput,
  SaveTechStackInput,
  SaveStyleGuideInput,
  SaveUserFeedbackInput,
  SaveReviewFeedbackInput,
  SaveBacklogInput,
  SaveDocInput,
  SaveMilestoneInput,
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

// ============================================
// DECISIONS (Decyzje architektoniczne)
// ============================================

/**
 * Zapisuje decyzję architektoniczną
 */
export async function saveDecision(input: SaveDecisionInput): Promise<Decision | null> {
  try {
    const { data, error } = await supabase
      .from('decisions')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description,
        reason: input.reason,
        alternatives: input.alternatives || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania decyzji:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano decyzję:', data.id, '-', data.title);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania decyzji:', error);
    return null;
  }
}

/**
 * Pobiera decyzje dla projektu
 */
export async function getDecisions(projectId: string): Promise<Decision[]> {
  try {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania decyzji:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania decyzji:', error);
    return [];
  }
}

// ============================================
// BUGS_HISTORY (Historia bugów)
// ============================================

/**
 * Zapisuje naprawiony bug do historii
 */
export async function saveBugHistory(input: SaveBugInput): Promise<BugHistory | null> {
  try {
    const { data, error } = await supabase
      .from('bugs_history')
      .insert({
        project_id: input.project_id,
        description: input.description,
        solution: input.solution,
        file_path: input.file_path || null,
        line_number: input.line_number || null,
        severity: input.severity || 'medium',
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania bug history:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano bug:', data.id);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania bug history:', error);
    return null;
  }
}

/**
 * Pobiera historię bugów dla projektu
 */
export async function getBugsHistory(projectId: string): Promise<BugHistory[]> {
  try {
    const { data, error } = await supabase
      .from('bugs_history')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania bugs history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania bugs history:', error);
    return [];
  }
}

// ============================================
// LLM_RESPONSES (Rozszerzone zapisywanie)
// ============================================

/**
 * Zapisuje odpowiedź LLM (rozszerzona wersja z tokenami)
 */
export async function saveLLMResponse(input: SaveLLMResponseInput): Promise<LLMResponse | null> {
  try {
    const { data, error } = await supabase
      .from('llm_responses')
      .insert({
        task_id: input.task_id || null,
        llm_source: input.llm_source,
        prompt_used: input.prompt_used,
        response: input.response,
        tokens_used: input.tokens_used,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania LLM response:', error);
      return null;
    }

    console.log(`[AUTO-SAVE] Zapisano odpowiedź ${input.llm_source}: ${input.tokens_used} tokenów`);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania LLM response:', error);
    return null;
  }
}

// ============================================
// PROMPTS (Wygenerowane prompty)
// ============================================

/**
 * Zapisuje wygenerowany prompt
 */
export async function savePrompt(input: SavePromptInput): Promise<Prompt | null> {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .insert({
        name: input.name,
        llm_target: input.llm_target,
        content: input.content,
        description: input.description || null,
        tags: input.tags || [],
        use_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania promptu:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano prompt:', data.id, '-', data.name);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania promptu:', error);
    return null;
  }
}

/**
 * Pobiera prompty dla danego celu
 */
export async function getPrompts(llmTarget?: string): Promise<Prompt[]> {
  try {
    let query = supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false });

    if (llmTarget) {
      query = query.eq('llm_target', llmTarget);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Błąd pobierania promptów:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania promptów:', error);
    return [];
  }
}

/**
 * Inkrementuje licznik użyć promptu
 */
export async function incrementPromptUseCount(promptId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_prompt_use_count', { prompt_id: promptId });
    if (error) {
      // Fallback jeśli RPC nie istnieje - pobierz i zaktualizuj
      const { data } = await supabase.from('prompts').select('use_count').eq('id', promptId).single();
      if (data) {
        await supabase.from('prompts').update({ use_count: (data.use_count || 0) + 1 }).eq('id', promptId);
      }
    }
  } catch (error) {
    console.error('Błąd inkrementacji use_count:', error);
  }
}

// ============================================
// PROJECT_RULES (Zasady projektu)
// ============================================

/**
 * Zapisuje zasadę projektu
 */
export async function saveProjectRule(input: SaveProjectRuleInput): Promise<ProjectRule | null> {
  try {
    // Sprawdź czy taka zasada już istnieje
    const { data: existing } = await supabase
      .from('project_rules')
      .select('id')
      .eq('project_id', input.project_id)
      .eq('rule', input.rule)
      .single();

    if (existing) {
      console.log('[AUTO-SAVE] Zasada już istnieje, pomijam');
      return null;
    }

    const { data, error } = await supabase
      .from('project_rules')
      .insert({
        project_id: input.project_id,
        rule: input.rule,
        category: input.category,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania project rule:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano zasadę projektu:', data.id);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania project rule:', error);
    return null;
  }
}

/**
 * Pobiera zasady dla projektu
 */
export async function getProjectRules(projectId: string): Promise<ProjectRule[]> {
  try {
    const { data, error } = await supabase
      .from('project_rules')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania project rules:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania project rules:', error);
    return [];
  }
}

// ============================================
// TECH_STACK (Technologie w projekcie)
// ============================================

/**
 * Zapisuje element tech stacku
 */
export async function saveTechStack(input: SaveTechStackInput): Promise<TechStackItem | null> {
  try {
    // Sprawdź czy technologia już istnieje w projekcie
    const { data: existing } = await supabase
      .from('tech_stack')
      .select('id')
      .eq('project_id', input.project_id)
      .ilike('name', input.name)
      .single();

    if (existing) {
      console.log('[AUTO-SAVE] Tech stack item już istnieje, pomijam');
      return null;
    }

    const { data, error } = await supabase
      .from('tech_stack')
      .insert({
        project_id: input.project_id,
        name: input.name,
        category: input.category,
        version: input.version || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania tech stack:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano tech stack:', data.name);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania tech stack:', error);
    return null;
  }
}

/**
 * Pobiera tech stack dla projektu
 */
export async function getTechStack(projectId: string): Promise<TechStackItem[]> {
  try {
    const { data, error } = await supabase
      .from('tech_stack')
      .select('*')
      .eq('project_id', projectId)
      .order('category', { ascending: true });

    if (error) {
      console.error('Błąd pobierania tech stack:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania tech stack:', error);
    return [];
  }
}

// ============================================
// STYLE_GUIDE (Zasady stylu kodu)
// ============================================

/**
 * Zapisuje zasadę stylu kodu
 */
export async function saveStyleGuide(input: SaveStyleGuideInput): Promise<StyleGuide | null> {
  try {
    const { data, error } = await supabase
      .from('style_guide')
      .insert({
        project_id: input.project_id,
        rule: input.rule,
        example_good: input.example_good || null,
        example_bad: input.example_bad || null,
        language: input.language || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania style guide:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano style guide:', data.id);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania style guide:', error);
    return null;
  }
}

/**
 * Pobiera style guide dla projektu
 */
export async function getStyleGuide(projectId: string): Promise<StyleGuide[]> {
  try {
    const { data, error } = await supabase
      .from('style_guide')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania style guide:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania style guide:', error);
    return [];
  }
}

// ============================================
// USER_FEEDBACK (Oceny odpowiedzi AI)
// ============================================

/**
 * Zapisuje feedback użytkownika
 */
export async function saveUserFeedback(input: SaveUserFeedbackInput): Promise<UserFeedback | null> {
  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        llm_response_id: input.llm_response_id,
        rating: input.rating,
        comment: input.comment || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania user feedback:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano user feedback:', data.id, '- rating:', data.rating);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania user feedback:', error);
    return null;
  }
}

// ============================================
// REVIEW_FEEDBACK (Feedback z code review)
// ============================================

/**
 * Zapisuje feedback z code review
 */
export async function saveReviewFeedback(input: SaveReviewFeedbackInput): Promise<ReviewFeedback | null> {
  try {
    const { data, error } = await supabase
      .from('review_feedback')
      .insert({
        task_id: input.task_id,
        reviewer: input.reviewer,
        feedback_type: input.feedback_type,
        description: input.description,
        suggestion: input.suggestion || null,
        was_applied: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania review feedback:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano review feedback:', data.id);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania review feedback:', error);
    return null;
  }
}

/**
 * Pobiera review feedback dla zadania
 */
export async function getReviewFeedback(taskId: string): Promise<ReviewFeedback[]> {
  try {
    const { data, error } = await supabase
      .from('review_feedback')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Błąd pobierania review feedback:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania review feedback:', error);
    return [];
  }
}

// ============================================
// BACKLOG (Pomysły/TODO)
// ============================================

/**
 * Zapisuje element do backlogu
 */
export async function saveBacklogItem(input: SaveBacklogInput): Promise<BacklogItem | null> {
  try {
    const { data, error } = await supabase
      .from('backlog')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description || null,
        priority: input.priority || 'medium',
        status: 'idea',
        tags: input.tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania backlog item:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano backlog item:', data.id, '-', data.title);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania backlog item:', error);
    return null;
  }
}

/**
 * Pobiera backlog dla projektu
 */
export async function getBacklog(projectId: string): Promise<BacklogItem[]> {
  try {
    const { data, error } = await supabase
      .from('backlog')
      .select('*')
      .eq('project_id', projectId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania backlog:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania backlog:', error);
    return [];
  }
}

/**
 * Aktualizuje status elementu backlogu
 */
export async function updateBacklogStatus(id: string, status: string): Promise<void> {
  try {
    await supabase
      .from('backlog')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error('Błąd aktualizacji backlog status:', error);
  }
}

// ============================================
// DOCS (Dokumentacja)
// ============================================

/**
 * Zapisuje dokumentację
 */
export async function saveDoc(input: SaveDocInput): Promise<Doc | null> {
  try {
    const { data, error } = await supabase
      .from('docs')
      .insert({
        project_id: input.project_id,
        title: input.title,
        content: input.content,
        doc_type: input.doc_type,
        file_path: input.file_path || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania doc:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano doc:', data.id, '-', data.title);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania doc:', error);
    return null;
  }
}

/**
 * Pobiera dokumentację dla projektu
 */
export async function getDocs(projectId: string): Promise<Doc[]> {
  try {
    const { data, error } = await supabase
      .from('docs')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania docs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania docs:', error);
    return [];
  }
}

// ============================================
// MILESTONES (Kamienie milowe)
// ============================================

/**
 * Zapisuje kamień milowy
 */
export async function saveMilestone(input: SaveMilestoneInput): Promise<Milestone | null> {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id: input.project_id,
        title: input.title,
        description: input.description || null,
        status: 'planned',
        target_date: input.target_date || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania milestone:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano milestone:', data.id, '-', data.title);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania milestone:', error);
    return null;
  }
}

/**
 * Pobiera kamienie milowe dla projektu
 */
export async function getMilestones(projectId: string): Promise<Milestone[]> {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('target_date', { ascending: true });

    if (error) {
      console.error('Błąd pobierania milestones:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd pobierania milestones:', error);
    return [];
  }
}

/**
 * Aktualizuje status kamienia milowego
 */
export async function updateMilestoneStatus(id: string, status: string): Promise<void> {
  try {
    const updates: Record<string, unknown> = { status };
    if (status === 'completed') {
      updates.completed_date = new Date().toISOString();
    }
    await supabase.from('milestones').update(updates).eq('id', id);
  } catch (error) {
    console.error('Błąd aktualizacji milestone status:', error);
  }
}

// ============================================
// MEMORY_EMBEDDINGS (Semantic Search)
// ============================================

/**
 * Zapisuje embedding do pamięci (bez faktycznego embedowania - wymaga osobnego serwisu)
 */
export async function saveMemoryEmbedding(
  content: string,
  contentType: 'code' | 'decision' | 'bug' | 'rule' | 'doc' | 'conversation',
  projectId?: string,
  sourceId?: string
): Promise<MemoryEmbedding | null> {
  try {
    const { data, error } = await supabase
      .from('memory_embeddings')
      .insert({
        project_id: projectId || null,
        content,
        content_type: contentType,
        source_id: sourceId || null,
        // embedding będzie dodany przez trigger/funkcję w Supabase
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTO-SAVE] Błąd zapisywania memory embedding:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Zapisano memory embedding:', data.id, '-', contentType);
    return data;
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania memory embedding:', error);
    return null;
  }
}

/**
 * Wyszukuje podobne embeddingi (wymaga pg_vector w Supabase)
 */
export async function searchSimilarEmbeddings(
  queryEmbedding: number[],
  projectId?: string,
  limit: number = 5
): Promise<MemoryEmbedding[]> {
  try {
    // Ta funkcja wymaga RPC w Supabase z pg_vector
    const { data, error } = await supabase.rpc('search_similar_embeddings', {
      query_embedding: queryEmbedding,
      match_project_id: projectId || null,
      match_count: limit,
    });

    if (error) {
      console.error('Błąd wyszukiwania embeddings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Błąd wyszukiwania embeddings:', error);
    return [];
  }
}

// ============================================
// PROJEKTY - rozszerzenie (tworzenie)
// ============================================

/**
 * Tworzy nowy projekt
 */
export async function createProject(
  name: string,
  description?: string,
  repoUrl?: string,
  techStack?: string[]
): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description: description || null,
        repo_url: repoUrl || null,
        tech_stack: techStack || [],
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Błąd tworzenia projektu:', error);
      return null;
    }

    console.log('[AUTO-SAVE] Utworzono projekt:', data.id, '-', data.name);
    return data;
  } catch (error) {
    console.error('Błąd tworzenia projektu:', error);
    return null;
  }
}

/**
 * Aktualizuje projekt
 */
export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Błąd aktualizacji projektu:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Błąd aktualizacji projektu:', error);
    return null;
  }
}
