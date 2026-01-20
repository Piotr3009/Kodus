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
  tech_stack?: string[];  // Stack technologiczny projektu
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

// ==========================================
// TYPY DLA CHAT INTERFACE Z MULTI-AI TEAM
// ==========================================

// Nadawca wiadomości AI
export type AISender = 'claude' | 'gpt' | 'gemini';

// Nadawca wiadomości (user lub AI)
export type MessageSender = 'user' | AISender;

// Tryb chatu: solo/duo/team
export type ChatMode = 'solo' | 'duo' | 'team';

// Blok kodu w wiadomości
export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

// Wiadomość w chacie
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender: MessageSender;
  content: string;
  code_blocks?: CodeBlock[];
  created_at: string;
}

// Rozmowa/konwersacja
export interface Conversation {
  id: string;
  project_id?: string;
  title: string;
  mode: ChatMode;
  created_at: string;
  updated_at: string;
}

// Plik w edytorze kodu
export interface EditorFile {
  id: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

// Osobowość AI (kolor, rola, avatar)
export interface AIPersonality {
  name: AISender;
  displayName: string;
  color: string;
  bgColor: string;
  role: string;
  avatar: string;
}

// Opis trybu chatu
export interface ChatModeInfo {
  label: string;
  description: string;
  icons: string;
}

// Event SSE dla chatu (streaming)
export interface ChatStreamEvent {
  type: 'typing' | 'message' | 'done' | 'error' | 'conversation_id';
  sender?: MessageSender;
  content?: string;
  error?: string;
  id?: string;
}

// Kontekst dla AI (historia, preferencje, projekt)
export interface AIContext {
  history: ChatMessage[];
  preferences?: Preference[];
  project?: Project;
  editorContent?: string;
  projectContext?: string;  // Kontekst projektu (struktura + zawartość plików)
}

// Preferencje użytkownika (stary format - do usunięcia w przyszłości)
export interface UserPreferences {
  id: string;
  preferred_mode: ChatMode;
  theme: 'dark' | 'light';
  language: string;
  created_at?: string;
  updated_at?: string;
}

// Pojedyncza preferencja użytkownika (nowy format)
export interface Preference {
  id: string;
  category: string;       // np. "ui", "code", "general"
  key: string;            // np. "preferred_theme", "tech_stack"
  value: string;          // np. "dark", "React, TypeScript, Tailwind"
  created_at?: string;
  updated_at?: string;
}

// Request do /api/chat
export interface ChatRequest {
  conversation_id?: string;
  message: string;
  mode: ChatMode;
  project_id?: string;
  projectContext?: string;
  context?: {
    editorContent?: string;
    action?: 'generate' | 'discuss';
  };
}

// Response z /api/chat (initial)
export interface ChatResponse {
  conversation_id: string;
  success: boolean;
  error?: string;
}

// Props dla komponentów chatu
export interface ChatPanelProps {
  conversationId: string | null;
  projectId?: string;
}

export interface ChatMessageProps {
  message: ChatMessage;
  onInsertCode?: (code: string, filename?: string, language?: string) => void;
}

export interface ChatInputProps {
  onSend: (content: string, mode: ChatMode) => void;
  isLoading: boolean;
  currentlyTyping: AISender | null;
  defaultMode?: ChatMode;
}

export interface ModeSelectorProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

export interface TypingIndicatorProps {
  sender: AISender;
  queue?: AISender[];
}

export interface CodeEditorProps {
  files: EditorFile[];
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileChange: (id: string, content: string) => void;
  onFileClose: (id: string) => void;
  onNewFile: (name: string, language: string) => void;
}

export interface FileTabsProps {
  files: EditorFile[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Plik dodany do kontekstu
export interface AdditionalFile {
  path: string;
  content: string;
}

// Hook returns
export interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string, mode: ChatMode) => Promise<void>;
  isLoading: boolean;
  currentlyTyping: AISender | null;
  typingQueue: AISender[];
  startNewConversation: () => void;
  loadConversation: (id: string) => Promise<void>;
  conversationId: string | null;
  error: string | null;
  conversations: Conversation[];
  loadConversations: () => Promise<void>;
  // Nowe pola dla kontekstu projektu
  projectContext: string | null;
  additionalFiles: AdditionalFile[];
  updateProjectContext: (context: string | null) => void;
  addFile: (path: string, content: string) => void;
  removeFile: (path: string) => void;
  clearProjectContext: () => void;
}

export interface UseCodeEditorReturn {
  files: EditorFile[];
  activeFile: EditorFile | null;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  createFile: (name: string, language: string) => void;
  closeFile: (id: string) => void;
  hasUnsavedChanges: boolean;
  insertCode: (code: string, filename?: string, language?: string) => void;
}

export interface UseGitHubReturn {
  isConnected: boolean;
  connect: (repoUrl: string) => Promise<void>;
  push: (files: EditorFile[], message: string) => Promise<void>;
  pull: () => Promise<void>;
  status: 'disconnected' | 'synced' | 'ahead' | 'behind';
}

// ==========================================
// TYPY DLA PANELU ARTEFAKTÓW
// ==========================================

// Artefakt - pojedynczy plik kodu w panelu
export interface Artifact {
  id: string;
  filename: string;
  language: string;
  content: string;
  createdAt: string;
}

// Hook return dla useArtifacts
export interface UseArtifactsReturn {
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  isOpen: boolean;
  addArtifact: (filename: string, language: string, content: string) => void;
  removeArtifact: (id: string) => void;
  setActiveArtifact: (id: string) => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  clearArtifacts: () => void;
}
