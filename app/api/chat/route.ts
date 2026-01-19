/**
 * API Route: /api/chat
 * Dyrygent - orkiestruje wywołania AI w odpowiedniej kolejności
 *
 * Flow:
 * - Solo:  Claude only
 * - Duo:   Claude → GPT → Claude (summary)
 * - Team:  Claude → GPT → Gemini → Claude (final)
 *
 * Używa Server-Sent Events (SSE) do streamowania odpowiedzi
 */

import { NextRequest } from 'next/server';
import { callClaude, callClaudeSummary, callClaudeFinal } from '@/lib/ai/claude';
import { callGPT } from '@/lib/ai/gpt';
import { callGemini } from '@/lib/ai/gemini';
import {
  createConversation,
  getConversationHistory,
  saveChatMessage,
  getProjectById,
} from '@/lib/supabase';
import { isGenerateAction, CHAT_HISTORY_LIMIT } from '@/lib/constants';
import type { ChatRequest, ChatMessage, ChatMode, MessageSender, AIContext } from '@/lib/types';

// Helper do wysyłania SSE
function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null;
    },
  });

  const sendEvent = (data: object) => {
    if (controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      } catch {
        // Stream zamknięty
      }
    }
  };

  const close = () => {
    if (controller) {
      try {
        controller.close();
      } catch {
        // Już zamknięty
      }
    }
  };

  return { stream, sendEvent, close };
}

// Główna funkcja orkiestrująca AI
async function orchestrateAI(
  sendEvent: (data: object) => void,
  close: () => void,
  conversationId: string,
  message: string,
  mode: ChatMode,
  context: AIContext
) {
  try {
    // Sprawdź czy to trigger do generowania
    const action = isGenerateAction(message) ? 'generate' : 'discuss';
    const enhancedMessage = action === 'generate'
      ? `${message}\n\n[TRYB GENEROWANIA - napisz pełny, działający kod]`
      : message;

    // 1. CLAUDE - zawsze pierwszy
    sendEvent({ type: 'typing', sender: 'claude' });

    let claudeResponse: string;
    try {
      claudeResponse = await callClaude(enhancedMessage, context.history, context);
    } catch (error) {
      sendEvent({ type: 'error', error: `Błąd Claude: ${error instanceof Error ? error.message : 'nieznany'}` });
      close();
      return;
    }

    sendEvent({ type: 'message', sender: 'claude', content: claudeResponse });
    await saveChatMessage(conversationId, 'claude', claudeResponse);

    // Solo mode - koniec
    if (mode === 'solo') {
      sendEvent({ type: 'done' });
      close();
      return;
    }

    // 2. GPT - review
    sendEvent({ type: 'typing', sender: 'gpt' });

    let gptResponse: string;
    try {
      gptResponse = await callGPT(message, claudeResponse, context.history, context);
    } catch (error) {
      // GPT błąd - kontynuuj bez niego
      console.error('GPT error:', error);
      gptResponse = 'Nie mogłem przeanalizować kodu w tym momencie.';
    }

    sendEvent({ type: 'message', sender: 'gpt', content: gptResponse });
    await saveChatMessage(conversationId, 'gpt', gptResponse);

    // Duo mode - Claude podsumowuje
    if (mode === 'duo') {
      sendEvent({ type: 'typing', sender: 'claude' });

      let claudeSummary: string;
      try {
        claudeSummary = await callClaudeSummary(message, claudeResponse, gptResponse, context);
      } catch (error) {
        claudeSummary = 'Podsumowując feedback od GPT - moja oryginalna propozycja pozostaje aktualna.';
      }

      sendEvent({ type: 'message', sender: 'claude', content: claudeSummary });
      await saveChatMessage(conversationId, 'claude', claudeSummary);

      sendEvent({ type: 'done' });
      close();
      return;
    }

    // 3. GEMINI - UI/UX (mode === 'team')
    sendEvent({ type: 'typing', sender: 'gemini' });

    let geminiResponse: string;
    try {
      geminiResponse = await callGemini(message, claudeResponse, gptResponse, context.history, context);
    } catch (error) {
      // Gemini błąd - kontynuuj bez niego
      console.error('Gemini error:', error);
      geminiResponse = 'Nie mogłem przeanalizować UI/UX w tym momencie.';
    }

    sendEvent({ type: 'message', sender: 'gemini', content: geminiResponse });
    await saveChatMessage(conversationId, 'gemini', geminiResponse);

    // 4. CLAUDE - podsumowanie finalne
    sendEvent({ type: 'typing', sender: 'claude' });

    let claudeFinal: string;
    try {
      claudeFinal = await callClaudeFinal(message, claudeResponse, gptResponse, geminiResponse, context);
    } catch (error) {
      claudeFinal = 'Uwzględniając feedback od GPT i Gemini - oto finalna wersja mojej propozycji.';
    }

    sendEvent({ type: 'message', sender: 'claude', content: claudeFinal });
    await saveChatMessage(conversationId, 'claude', claudeFinal);

    sendEvent({ type: 'done' });
    close();

  } catch (error) {
    console.error('Orchestration error:', error);
    sendEvent({
      type: 'error',
      error: error instanceof Error ? error.message : 'Nieznany błąd podczas przetwarzania'
    });
    close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { conversation_id, message, mode, project_id, context: requestContext } = body;

    // Walidacja
    if (!message || !mode) {
      return new Response(
        JSON.stringify({ error: 'Brak wymaganych pól: message, mode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Utwórz lub użyj istniejącej konwersacji
    let conversationId = conversation_id;
    if (!conversationId) {
      // Utwórz nową konwersację z tytułem z pierwszych słów wiadomości
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      const conversation = await createConversation(title, mode, project_id);
      conversationId = conversation.id;
    }

    // Zapisz wiadomość użytkownika
    await saveChatMessage(conversationId, 'user', message);

    // Pobierz historię i kontekst
    const history = await getConversationHistory(conversationId, CHAT_HISTORY_LIMIT);
    const project = project_id ? await getProjectById(project_id) : undefined;

    const context: AIContext = {
      history,
      project: project || undefined,
      editorContent: requestContext?.editorContent,
    };

    // Utwórz SSE stream
    const { stream, sendEvent, close } = createSSEStream();

    // Wyślij conversation_id na początku
    sendEvent({ type: 'conversation_id', id: conversationId });

    // Uruchom orkiestrację w tle (nie blokuje response)
    orchestrateAI(sendEvent, close, conversationId, message, mode, context);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Błąd serwera' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
