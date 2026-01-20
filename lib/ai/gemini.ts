/**
 * Moduł Gemini - specjalista UI/UX
 * Używa Google Generative AI SDK do komunikacji z Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage, AIContext, Preference } from '../types';

// Leniwa inicjalizacja klienta Google AI
let genaiClient: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }
  return genaiClient;
}

// System prompt dla Gemini jako specjalisty UI/UX
const GEMINI_SYSTEM_PROMPT = `Jesteś Gemini - specjalistą UI/UX w zespole AI, ale TAKŻE patrzysz na kod.

TWOJA ROLA:
- Oceniasz kod pod kątem user experience
- Proponujesz ulepszenia wizualne i interakcji
- Dbasz o responsywność i mobile-first
- Sprawdzasz accessibility (a11y)
- TAKŻE sprawdzasz kod - jeśli widzisz bug, POWIEDZ

DOSTĘP DO PLIKÓW PROJEKTU:
Masz dostęp do plików projektu użytkownika. Możesz poprosić o:
- [POKAŻ STRUKTURĘ] - zobaczysz drzewo plików projektu
- [POKAŻ PLIK: ścieżka/do/pliku] - zobaczysz zawartość konkretnego pliku
Użytkownik wklei ci zawartość. Używaj tego do oceny spójności UI/UX w projekcie.

NA CO ZWRACASZ UWAGĘ:
- Kontrast kolorów i czytelność
- Spójność designu
- Loading states i skeleton screens
- Hover/focus states
- Touch targets na mobile
- Animacje (ale nie przesadzaj)

ZASADY (KRYTYCZNE):
- ZERO chwalenia Claude'a lub GPT
- Odpowiedź MAKSYMALNIE 3-5 punktów
- Jeśli UI jest OK i kod OK - napisz tylko "OK, brak uwag"
- Tylko KONKRETNE uwagi z przykładem Tailwind
- Bez wstępów, bez gadania
- Jeśli masz wątpliwości - pytaj użytkownika

FORMAT ODPOWIEDZI:
Jeśli są uwagi:
- [UI] opis + propozycja Tailwind
- [UX] opis problemu
- [A11Y] problem accessibility
- [BUG] jeśli widzisz błąd w kodzie

Jeśli brak uwag:
OK, brak uwag.

ZAKAZANE FRAZY:
- "Claude świetnie to zrobił"
- "Zgadzam się z GPT"
- Jakiekolwiek komplementy`;

/**
 * Formatuje historię dla Gemini (prosty string, Gemini nie ma tak zaawansowanego API)
 */
function formatHistoryForGemini(history: ChatMessage[]): string {
  if (history.length === 0) return '';

  const formattedHistory = history.slice(-10).map(msg => {
    const sender = msg.sender === 'user' ? 'User' : msg.sender.toUpperCase();
    return `${sender}: ${msg.content}`;
  }).join('\n\n');

  return `\nHistoria rozmowy:\n${formattedHistory}\n\n`;
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
    info += `\nProjekt: ${context.project.name}`;
    // Dodaj tech stack projektu
    info += formatTechStack(context.project.tech_stack);
  }

  // Dodaj pełny kontekst projektu (struktura + pliki) jeśli załadowany
  if (context.projectContext) {
    info += `\n\n=== ZAŁADOWANY KONTEKST PROJEKTU ===\n${context.projectContext}\n=== KONIEC KONTEKSTU ===`;
  }

  // Dodaj preferencje użytkownika
  if (context.preferences && context.preferences.length > 0) {
    info += formatPreferences(context.preferences);
  }

  return info;
}

/**
 * Wywołuje Gemini do oceny UI/UX
 */
export async function callGemini(
  userMessage: string,
  claudeResponse: string,
  gptResponse: string,
  history: ChatMessage[],
  context?: AIContext
): Promise<string> {
  const contextInfo = buildContextInfo(context);
  const historyContext = formatHistoryForGemini(history);

  const prompt = `${GEMINI_SYSTEM_PROMPT}
${contextInfo}
${historyContext}

User napisał: ${userMessage}

Claude odpowiedział:
${claudeResponse}

GPT skomentował:
${gptResponse}

Daj swój feedback z perspektywy UI/UX. Bądź konkretny i praktyczny:`;

  try {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-pro' });

    const result = await model.generateContent(prompt);
    const response = result.response;

    return response.text() || 'Nie mogłem wygenerować feedbacku UI/UX.';
  } catch (error) {
    console.error('Błąd Gemini:', error);
    throw new Error(`Błąd komunikacji z Gemini: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}
