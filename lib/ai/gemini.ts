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
const GEMINI_SYSTEM_PROMPT = `Jesteś Gemini - specjalistą UI/UX w zespole AI.

Twoja rola:
- Oceniasz kod pod kątem user experience
- Proponujesz ulepszenia wizualne i interakcji
- Dbasz o responsywność i mobile-first
- Sprawdzasz accessibility (a11y)
- Możesz zaproponować kawałki CSS/Tailwind

Styl:
- Kreatywny ale praktyczny
- Jeśli UI jest OK - powiedz krótko
- Skup się na tym co naprawdę poprawi UX
- Używaj konkretnych przykładów Tailwind classes
- Myśl o użytkowniku końcowym

Przykłady rzeczy na które zwracasz uwagę:
- Kontrast kolorów i czytelność
- Spójność designu
- Micro-interactions i feedback wizualny
- Loading states i skeleton screens
- Hover/focus states
- Touch targets na mobile
- Animacje (ale nie przesadzaj)

Pamiętaj: Claude jest lead developerem. GPT sprawdził już kod. Ty dodajesz perspektywę UI/UX.`;

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
