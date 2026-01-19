/**
 * Typy TypeScript dla AI Agent Dashboard
 * Odzwierciedlają strukturę istniejących tabel Supabase
 */

// Status projektu
export type ProjectStatus = 'active' | 'archived' | 'pending';

// Status zadania
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// Tryb wykonania zadania
export type TaskMode = 'simple' | 'full';

// Źródło LLM
export type LLMSource = 'claude' | 'gpt' | 'gemini';

// Status SSE dla StatusBar
export type StreamStatus =
  | 'idle'
  | 'claude_working'
  | 'gpt_review'
  | 'gemini_review'
  | 'claude_fixing'
  | 'done'
  | 'error';

// Projekt z tabeli projects
export interface Project {
  id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  status: ProjectStatus;
  created_at?: string;
  updated_at?: string;
}

// Zadanie z tabeli tasks
export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  iteration_count: number;
  final_code: string | null;
  created_at?: string;
  updated_at?: string;
  // Relacja z projektem (opcjonalna)
  project?: Project;
}

// Iteracja zadania z tabeli task_iterations
export interface TaskIteration {
  id: string;
  task_id: string;
  iteration_number: number;
  claude_code: string | null;
  gpt_feedback: string | null;
  gemini_feedback: string | null;
  created_at?: string;
}

// Odpowiedź LLM z tabeli llm_responses
export interface LLMResponse {
  id: string;
  task_id: string;
  llm_source: LLMSource;
  prompt_used: string | null;
  response: string | null;
  tokens_used: number | null;
  created_at?: string;
}

// Plik z Storage
export interface StorageFile {
  name: string;
  size: number;
  type: string;
  path: string;
  url?: string;
  created_at?: string;
}

// Event SSE
export interface StreamEvent {
  status: StreamStatus;
  iteration?: number;
  maxIterations?: number;
  message: string;
  code?: string;
  files?: StorageFile[];
  error?: string;
  timestamp?: string;
}

// Request do webhook
export interface WebhookRequest {
  task: string;
  project_id: string | null;
  mode: TaskMode;
  context?: {
    project?: Project;
    recent_tasks?: Task[];
  };
}

// Response z webhook
export interface WebhookResponse {
  task_id: string;
  stream_url: string;
  error?: string;
}

// Parametry filtru zadań
export interface TaskFilters {
  project_id?: string | null;
  search?: string;
  status?: TaskStatus;
  limit?: number;
  offset?: number;
}

// Stan formularza zadania
export interface TaskFormState {
  task: string;
  project_id: string | null;
  mode: TaskMode;
  isSubmitting: boolean;
}

// Stan historii zadań
export interface TaskHistoryState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  selectedTaskId: string | null;
}

// Stan projektów
export interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  selectedProjectId: string | null;
}

// Stan streamu
export interface StreamState {
  isConnected: boolean;
  status: StreamStatus;
  currentIteration: number;
  maxIterations: number;
  message: string;
  code: string | null;
  files: StorageFile[];
  error: string | null;
  startTime: number | null;
  elapsedTime: number;
}

// Props dla komponentów
export interface TaskInputProps {
  projects: Project[];
  onSubmit: (data: TaskFormState) => Promise<void>;
  isDisabled?: boolean;
}

export interface StatusBarProps {
  status: StreamStatus;
  iteration: number;
  maxIterations: number;
  message: string;
  elapsedTime: number;
}

export interface CodeOutputProps {
  code: string | null;
  language?: string;
  isLoading?: boolean;
}

export interface FilesListProps {
  files: StorageFile[];
  isLoading?: boolean;
}

export interface TaskHistoryProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onTaskSelect: (task: Task) => void;
  isLoading?: boolean;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  isLoading?: boolean;
  showAllOption?: boolean;
}

export interface ModeToggleProps {
  mode: TaskMode;
  onChange: (mode: TaskMode) => void;
}
