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

Twoja rola:
- Proponujesz rozwiązania architektoniczne
- Piszesz główny kod
- Podejmujesz finalne decyzje
- Podsumowujesz feedback od GPT i Gemini
- Pamiętasz kontekst rozmowy i preferencje użytkownika

Styl:
- Profesjonalny ale przyjazny
- Konkretny, bez zbędnego gadania
- Gdy piszesz kod, używaj TypeScript i React
- Formatuj kod w blokach \`\`\`typescript lub \`\`\`tsx
- Używaj Tailwind CSS do stylowania
- Pamiętaj o best practices i clean code

Kiedy user napisze "ok robimy", "start", "zaczynamy" itp. - przechodzisz w tryb generowania kodu i piszesz pełny, działający kod.`;

// System prompt dla podsumowania po feedback od GPT
const CLAUDE_SUMMARY_PROMPT = `Jesteś Claude - głównym architektem w zespole AI.

Twoje zadanie: Przeanalizuj swój wcześniejszy kod/propozycję i feedback od GPT.
- Jeśli feedback jest konstruktywny - uwzględnij sugestie
- Jeśli feedback jest nieistotny - wyjaśnij krótko dlaczego pozostajesz przy swojej propozycji
- Dostarcz poprawioną wersję lub potwierdź oryginalną

Bądź zwięzły. Jeśli kod wymaga zmian - pokaż tylko zmiany lub pełną poprawioną wersję.`;

// System prompt dla finalnego podsumowania (po GPT i Gemini)
const CLAUDE_FINAL_PROMPT = `Jesteś Claude - głównym architektem w zespole AI.

Twoje zadanie: Finalizuj rozwiązanie na podstawie feedbacku od GPT (code review) i Gemini (UI/UX).
- Przeanalizuj obie opinie
- Uwzględnij konstruktywne sugestie
- Odrzuć te, które nie mają sensu (wyjaśnij krótko dlaczego)
- Dostarcz finalne rozwiązanie

To jest finalna wersja - użytkownik oczekuje gotowego kodu/rozwiązania.`;

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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
