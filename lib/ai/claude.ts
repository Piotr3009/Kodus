/**
 * Moduł Claude AI - główny architekt i lead developer
 * Używa Anthropic SDK do komunikacji z Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, AIContext, Preference } from '../types';

// Leniwa inicjalizacja klienta Anthropic
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// System prompt dla Claude jako głównego architekta
const CLAUDE_SYSTEM_PROMPT = `Jesteś Claude - głównym architektem i lead developerem w zespole AI.

TWOJA ROLA:
- Proponujesz rozwiązania architektoniczne
- Piszesz główny kod
- Podejmujesz finalne decyzje
- Podsumowujesz feedback od GPT i Gemini
- Pamiętasz kontekst rozmowy i preferencje użytkownika

DOSTĘP DO PLIKÓW PROJEKTU:
Masz dostęp do plików projektu użytkownika. Możesz poprosić o:
- [POKAŻ STRUKTURĘ] - zobaczysz drzewo plików projektu
- [POKAŻ PLIK: ścieżka/do/pliku] - zobaczysz zawartość konkretnego pliku
Użytkownik wklei ci zawartość. Używaj tego do analizy istniejącego kodu.

ZASADY PRACY (KRYTYCZNE):
- NIGDY nie generuj kodu bez potwierdzenia użytkownika ("ok", "tak", "robimy", "dawaj")
- Odpowiedzi KRÓTKIE i TREŚCIWE - bez zbędnych słów
- Nie chwal innych AI - to marnuje tokeny
- Jeśli masz wątpliwości - PYTAJ użytkownika
- Skup się na zadaniu, nie na dyskusji
- Jeśli nie możesz napisać całego kodu - poinformuj
- Przed większymi zmianami - przedstaw plan i czekaj na potwierdzenie

STYL KODU:
- TypeScript i React (domyślnie)
- Tailwind CSS do stylowania
- Formatuj kod w blokach \`\`\`typescript lub \`\`\`tsx
- Best practices i clean code
- Dostosuj się do tech stacku projektu jeśli podany

FORMAT ODPOWIEDZI:
- Maksymalnie 2-3 akapity tekstu
- Kod tylko po potwierdzeniu
- Bez wstępów typu "Świetnie!", "Oczywiście!", "Jasne!"`;

// System prompt dla podsumowania po feedback od GPT
const CLAUDE_SUMMARY_PROMPT = `Jesteś Claude - głównym architektem w zespole AI.

Przeanalizuj swój kod i feedback od GPT.
- Uwzględnij konstruktywne sugestie
- Odrzuć nieistotne (wyjaśnij krótko dlaczego)
- Daj poprawioną wersję

ZASADY:
- Odpowiedź KRÓTKA
- Bez chwalenia GPT
- Kod tylko jeśli są zmiany
- Bez wstępów`;

// System prompt dla finalnego podsumowania (po GPT i Gemini)
const CLAUDE_FINAL_PROMPT = `Jesteś Claude - głównym architektem w zespole AI.

Finalizuj rozwiązanie na podstawie feedbacku od GPT i Gemini.
- Uwzględnij konstruktywne sugestie
- Odrzuć nieistotne (wyjaśnij krótko)
- Daj finalne rozwiązanie

ZASADY:
- Odpowiedź KRÓTKA
- Bez chwalenia innych AI
- To jest finalna wersja - gotowy kod
- Bez wstępów`;

/**
 * Formatuje historię czatu do formatu wiadomości Anthropic
 */
function formatHistory(history: ChatMessage[], currentMessage: string): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Dodaj historię rozmowy
  for (const msg of history) {
    if (msg.sender === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else {
      // Wiadomości od AI traktujemy jako assistant
      messages.push({ role: 'assistant', content: `[${msg.sender.toUpperCase()}]: ${msg.content}` });
    }
  }

  // Dodaj aktualną wiadomość użytkownika
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

/**
 * Formatuje preferencje do czytelnego formatu dla AI
 */
function formatPreferences(preferences: Preference[]): string {
  if (!preferences || preferences.length === 0) return '';

  const lines = preferences.map(p => `- ${p.key}: ${p.value}`);
  return `\n\nPreferencje użytkownika (pamiętaj o nich!):\n${lines.join('\n')}`;
}

/**
 * Formatuje tech stack do czytelnego formatu
 */
function formatTechStack(techStack?: string[]): string {
  if (!techStack || techStack.length === 0) return '';
  return `\n\nProjekt używa: ${techStack.join(', ')}`;
}

/**
 * Buduje kontekst z informacjami o projekcie i preferencjach
 */
function buildContextInfo(context?: AIContext): string {
  if (!context) return '';

  let info = '';

  if (context.project) {
    info += `\n\nKontekst projektu:
- Nazwa: ${context.project.name}
- Opis: ${context.project.description || 'brak'}
- Repo: ${context.project.repo_url || 'brak'}`;

    // Dodaj tech stack projektu
    info += formatTechStack(context.project.tech_stack);
  }

  // Dodaj pełny kontekst projektu (struktura + pliki) jeśli załadowany
  if (context.projectContext) {
    info += `\n\n=== ZAŁADOWANY KONTEKST PROJEKTU ===\n${context.projectContext}\n=== KONIEC KONTEKSTU ===`;
  }

  if (context.editorContent) {
    info += `\n\nAktualny kod w edytorze:\n\`\`\`\n${context.editorContent}\n\`\`\``;
  }

  // Dodaj preferencje użytkownika
  if (context.preferences && context.preferences.length > 0) {
    info += formatPreferences(context.preferences);
  }

  return info;
}

/**
 * Wywołuje Claude jako głównego architekta (pierwsza odpowiedź)
 */
export async function callClaude(
  message: string,
  history: ChatMessage[],
  context?: AIContext
): Promise<string> {
  const contextInfo = buildContextInfo(context);
  const systemPrompt = CLAUDE_SYSTEM_PROMPT + contextInfo;

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: formatHistory(history, message),
    });

    // Wyciągnij tekst z odpowiedzi
    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'Przepraszam, nie mogłem wygenerować odpowiedzi.';
  } catch (error) {
    console.error('Błąd Claude:', error);
    throw new Error(`Błąd komunikacji z Claude: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Wywołuje Claude do podsumowania po feedback od GPT (tryb duo)
 */
export async function callClaudeSummary(
  originalMessage: string,
  claudeFirstResponse: string,
  gptFeedback: string,
  context?: AIContext
): Promise<string> {
  const contextInfo = buildContextInfo(context);
  const systemPrompt = CLAUDE_SUMMARY_PROMPT + contextInfo;

  const prompt = `Użytkownik napisał: ${originalMessage}

Moja wcześniejsza odpowiedź:
${claudeFirstResponse}

Feedback od GPT:
${gptFeedback}

Daj finalne rozwiązanie uwzględniając konstruktywny feedback:`;

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'Przepraszam, nie mogłem wygenerować podsumowania.';
  } catch (error) {
    console.error('Błąd Claude Summary:', error);
    throw new Error(`Błąd komunikacji z Claude: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}

/**
 * Wywołuje Claude do finalnego podsumowania po feedback od GPT i Gemini (tryb team)
 */
export async function callClaudeFinal(
  originalMessage: string,
  claudeFirstResponse: string,
  gptFeedback: string,
  geminiFeedback: string,
  context?: AIContext
): Promise<string> {
  const contextInfo = buildContextInfo(context);
  const systemPrompt = CLAUDE_FINAL_PROMPT + contextInfo;

  const prompt = `Użytkownik napisał: ${originalMessage}

Moja wcześniejsza odpowiedź:
${claudeFirstResponse}

Feedback od GPT (code review):
${gptFeedback}

Feedback od Gemini (UI/UX):
${geminiFeedback}

Daj finalne rozwiązanie uwzględniając konstruktywny feedback od obu:`;

  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock ? textBlock.text : 'Przepraszam, nie mogłem wygenerować finalnego podsumowania.';
  } catch (error) {
    console.error('Błąd Claude Final:', error);
    throw new Error(`Błąd komunikacji z Claude: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
  }
}
