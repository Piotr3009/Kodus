/**
 * Moduł GPT - code reviewer i generator pomysłów
 * Używa OpenAI SDK do komunikacji z GPT-4
 */

import OpenAI from 'openai';
import type { ChatMessage, AIContext, Preference } from '../types';

// Leniwa inicjalizacja klienta OpenAI
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// System prompt dla GPT jako code reviewera
const GPT_SYSTEM_PROMPT = `Jesteś GPT - code reviewerem w zespole AI.

TWOJA ROLA:
- Sprawdzasz kod Claude'a pod kątem bugów i optymalizacji
- Wyłapujesz edge cases i potencjalne problemy
- Sugerujesz ulepszenia wydajności i czytelności
- Sprawdzasz zgodność z best practices
- Proponujesz alternatywne rozwiązania (tylko gdy warto)

DOSTĘP DO PLIKÓW PROJEKTU:
Masz dostęp do plików projektu użytkownika. Możesz poprosić o:
- [POKAŻ STRUKTURĘ] - zobaczysz drzewo plików projektu
- [POKAŻ PLIK: ścieżka/do/pliku] - zobaczysz zawartość konkretnego pliku
Użytkownik wklei ci zawartość. Używaj tego do weryfikacji kodu w kontekście projektu.

ZASADY (KRYTYCZNE):
- ZERO chwalenia - nie pisz "świetny kod", "dobra robota", "podoba mi się"
- Odpowiedź MAKSYMALNIE 3-5 punktów
- Jeśli kod jest OK - napisz tylko "OK, brak uwag" i KONIEC
- NIE szukaj problemów na siłę
- Tylko KONKRETNE uwagi z przykładem kodu
- Bez wstępów, bez podsumowań
- Jeśli masz wątpliwości - pytaj użytkownika

FORMAT ODPOWIEDZI:
Jeśli są uwagi:
- [BUG] opis + fix
- [OPTYMALIZACJA] opis + przykład
- [EDGE CASE] opis
- [BEST PRACTICE] co poprawić

Jeśli brak uwag:
OK, brak uwag.

ZAKAZANE FRAZY:
- "Claude wykonał świetną robotę"
- "Kod jest dobrze napisany"
- "Podoba mi się podejście"
- "Ogólnie wygląda dobrze, ale..."`;

/**
 * Formatuje historię dla GPT
 */
function formatHistoryForGPT(history: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return history.map(msg => {
    if (msg.sender === 'user') {
      return { role: 'user' as const, content: msg.content };
    }
    // Wiadomości od AI jako assistant z prefixem
    return { role: 'assistant' as const, content: `[${msg.sender.toUpperCase()}]: ${msg.content}` };
  });
}

/**
 * Formatuje preferencje do czytelnego formatu dla AI
 */
function formatPreferences(preferences: Preference[]): string {
  if (!preferences || preferences.length === 0) return '';

  const lines = preferences.map(p => `- ${p.key}: ${p.value}`);
  return `\n\nPreferencje użytkownika:\n${lines.join('\n')}`;
}

/**
 * Formatuje tech stack do czytelnego formatu
 */
function formatTechStack(techStack?: string[]): string {
  if (!techStack || techStack.length === 0) return '';
  return `\nProjekt używa: ${techStack.join(', ')}`;
}

/**
 * Buduje kontekst z informacjami o projekcie
 */
function buildContextInfo(context?: AIContext): string {
  if (!context) return '';

  let info = '';

  if (context.project) {
    info += `\n\nKontekst projektu: ${context.project.name}`;
    if (context.project.description) {
      info += ` - ${context.project.description}`;
    }
    // Dodaj tech stack projektu
    info += formatTechStack(context.project.tech_stack);
  }

  // Dodaj pełny kontekst projektu (struktura + pliki) jeśli załadowany
  if (context.projectContext) {
    info += `\n\n=== ZAŁADOWANY KONTEKST PROJEKTU ===\n${context.projectContext}\n=== KONIEC KONTEKSTU ===`;
  }

  if (context.editorContent) {
    info += `\n\nAktualny kod w edytorze użytkownika:\n\`\`\`\n${context.editorContent}\n\`\`\``;
  }

  // Dodaj preferencje użytkownika
  if (context.preferences && context.preferences.length > 0) {
    info += formatPreferences(context.preferences);
  }

  return info;
}

/**
 * Wywołuje GPT do review kodu/odpowiedzi Claude'a
 */
export async function callGPT(
  userMessage: string,
  claudeResponse: string,
  history: ChatMessage[],
  context?: AIContext
): Promise<string> {
  const contextInfo = buildContextInfo(context);
  const systemPrompt = GPT_SYSTEM_PROMPT + contextInfo;

  const reviewPrompt = `User napisał: ${userMessage}

Claude odpowiedział:
${claudeResponse}

Daj swój feedback jako code reviewer. Bądź konstruktywny i konkretny:`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-5.2',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        ...formatHistoryForGPT(history),
        { role: 'user', content: reviewPrompt }
      ],
    });

    return response.choices[0]?.message?.content || 'Nie mogłem wygenerować feedbacku.';
  } catch (error) {
    console.error('Błąd GPT:', error);
    throw new Error(`Błąd komunikacji z GPT: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}
