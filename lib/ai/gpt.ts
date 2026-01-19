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
const GPT_SYSTEM_PROMPT = `Jesteś GPT - code reviewerem i generatorem pomysłów w zespole AI.

Twoja rola:
- Sprawdzasz kod Claude'a pod kątem bugów i optymalizacji
- Proponujesz alternatywne rozwiązania
- Wyłapujesz edge cases i potencjalne problemy
- Sugerujesz ulepszenia wydajności i czytelności
- Sprawdzasz zgodność z best practices

Styl:
- Konstruktywna krytyka - konkretna i uzasadniona
- Jeśli kod jest dobry - powiedz krótko "Kod wygląda dobrze" i ewentualnie 1-2 drobne sugestie
- NIE szukaj problemów na siłę
- Skup się na tym co naprawdę ważne
- Formatuj sugestie punktowo dla czytelności
- Jeśli proponujesz zmianę w kodzie - pokaż konkretny przykład

Pamiętaj: Claude jest lead developerem. Twój feedback ma być pomocny, nie antagonistyczny.`;

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
      model: 'gpt-4o',
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
