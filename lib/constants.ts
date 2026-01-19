/**
 * Stałe aplikacji AI Agent Dashboard
 */

import type { StreamStatus, LLMSource, AISender, AIPersonality, ChatMode, ChatModeInfo } from './types';

// Maksymalna liczba iteracji review
export const MAX_ITERATIONS = 3;

// Limit historii zadań
export const TASK_HISTORY_LIMIT = 20;

// Timeout dla SSE (ms)
export const SSE_TIMEOUT = 5 * 60 * 1000; // 5 minut

// Interwał heartbeat SSE (ms)
export const SSE_HEARTBEAT_INTERVAL = 30 * 1000; // 30 sekund

// Debounce dla wyszukiwania (ms)
export const SEARCH_DEBOUNCE = 300;

// Mapowanie statusów na wiadomości
export const STATUS_MESSAGES: Record<StreamStatus, string> = {
  idle: 'Oczekiwanie...',
  claude_working: 'Claude pisze kod...',
  gpt_review: 'GPT sprawdza...',
  gemini_review: 'Gemini sprawdza UI...',
  claude_fixing: 'Claude poprawia...',
  done: 'Zakończono',
  error: 'Wystąpił błąd',
};

// Mapowanie statusów na kolory (Tailwind classes)
export const STATUS_COLORS: Record<StreamStatus, string> = {
  idle: 'text-muted-foreground',
  claude_working: 'text-orange-500',
  gpt_review: 'text-green-500',
  gemini_review: 'text-blue-500',
  claude_fixing: 'text-orange-500',
  done: 'text-green-500',
  error: 'text-red-500',
};

// Kolory LLM
export const LLM_COLORS: Record<LLMSource, string> = {
  claude: 'text-orange-500',
  gpt: 'text-green-500',
  gemini: 'text-blue-500',
};

// Nazwy LLM
export const LLM_NAMES: Record<LLMSource, string> = {
  claude: 'Claude',
  gpt: 'GPT-4',
  gemini: 'Gemini',
};

// Mapowanie rozszerzeń na języki Monaco
export const FILE_EXTENSION_TO_LANGUAGE: Record<string, string> = {
  tsx: 'typescript',
  ts: 'typescript',
  jsx: 'javascript',
  js: 'javascript',
  css: 'css',
  scss: 'scss',
  json: 'json',
  sql: 'sql',
  html: 'html',
  md: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sh: 'shell',
  bash: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  graphql: 'graphql',
  gql: 'graphql',
};

// Ikony typów plików (nazwy z lucide-react)
export const FILE_TYPE_ICONS: Record<string, string> = {
  tsx: 'FileCode',
  ts: 'FileCode',
  jsx: 'FileCode',
  js: 'FileCode',
  css: 'Palette',
  scss: 'Palette',
  json: 'FileJson',
  sql: 'Database',
  html: 'Globe',
  md: 'FileText',
  py: 'FileCode',
  go: 'FileCode',
  rs: 'FileCode',
  default: 'File',
};

// Skróty klawiaturowe
export const KEYBOARD_SHORTCUTS = {
  SUBMIT: 'Ctrl+Enter',
  FOCUS_INPUT: 'Ctrl+K',
  CANCEL: 'Escape',
};

// Storage bucket name
export const STORAGE_BUCKET = 'artifacts';

// API endpoints
export const API_ENDPOINTS = {
  WEBHOOK: '/api/webhook',
  STREAM: '/api/stream',
};

// Czas formatowania
export const formatElapsedTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
};

// Formatowanie rozmiaru pliku
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Wykrywanie języka na podstawie kodu
export const detectLanguage = (code: string, filename?: string): string => {
  // Najpierw sprawdź rozszerzenie pliku
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && FILE_EXTENSION_TO_LANGUAGE[ext]) {
      return FILE_EXTENSION_TO_LANGUAGE[ext];
    }
  }

  // Heurystyka na podstawie zawartości
  if (code.includes('import React') || code.includes('useState') || code.includes('export default function')) {
    return code.includes('<') ? 'typescript' : 'typescript';
  }
  if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) {
    return 'typescript';
  }
  if (code.includes('const ') || code.includes('function ') || code.includes('=>')) {
    return 'javascript';
  }
  if (code.includes('SELECT ') || code.includes('INSERT ') || code.includes('CREATE TABLE')) {
    return 'sql';
  }
  if (code.includes('{') && code.includes(':') && code.includes('"')) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      // Nie jest JSONem
    }
  }
  if (code.includes('@apply') || code.includes('@tailwind') || code.includes('{') && code.includes(';')) {
    return 'css';
  }

  return 'typescript'; // Domyślnie TypeScript
};

// ==========================================
// STAŁE DLA CHAT INTERFACE Z MULTI-AI TEAM
// ==========================================

// Osobowości AI - kolory, role, avatary
export const AI_PERSONALITIES: Record<AISender, AIPersonality> = {
  claude: {
    name: 'claude',
    displayName: 'Claude',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    role: 'Architekt & Lead Developer',
    avatar: '🟣'
  },
  gpt: {
    name: 'gpt',
    displayName: 'GPT',
    color: '#22C55E',
    bgColor: '#22C55E20',
    role: 'Code Reviewer & Pomysły',
    avatar: '🟢'
  },
  gemini: {
    name: 'gemini',
    displayName: 'Gemini',
    color: '#3B82F6',
    bgColor: '#3B82F620',
    role: 'UI/UX Specialist',
    avatar: '🔵'
  }
};

// Kolor użytkownika
export const USER_COLOR = '#6B7280';
export const USER_BG_COLOR = '#6B728020';

// Tryby chatu
export const CHAT_MODES: Record<ChatMode, ChatModeInfo> = {
  solo: {
    label: 'Solo',
    description: 'Tylko Claude - szybkie odpowiedzi',
    icons: '🟣'
  },
  duo: {
    label: 'Duo',
    description: 'Claude + GPT review',
    icons: '🟣🟢'
  },
  team: {
    label: 'Team',
    description: 'Pełny zespół: Claude + GPT + Gemini',
    icons: '🟣🟢🔵'
  }
};

// Triggery do generowania kodu
export const GENERATE_TRIGGERS = [
  'ok robimy',
  'start',
  'zaczynamy',
  'generuj',
  'do dzieła',
  "let's go",
  'lets go',
  'budujemy',
  'koduj',
  'pisz kod',
  'napisz kod'
];

// Sprawdza czy wiadomość jest triggerem do generowania
export const isGenerateAction = (message: string): boolean => {
  const lower = message.toLowerCase().trim();
  return GENERATE_TRIGGERS.some(trigger => lower.includes(trigger));
};

// Limit historii wiadomości do kontekstu AI
export const CHAT_HISTORY_LIMIT = 20;

// API endpoints dla chatu
export const CHAT_API_ENDPOINTS = {
  CHAT: '/api/chat',
  CONVERSATIONS: '/api/conversations',
};

// Skróty klawiaturowe dla chatu
export const CHAT_KEYBOARD_SHORTCUTS = {
  SEND: 'Ctrl+Enter',
  NEW_CONVERSATION: 'Ctrl+N',
  TOGGLE_SIDEBAR: 'Ctrl+B',
  FOCUS_INPUT: 'Ctrl+K',
};
