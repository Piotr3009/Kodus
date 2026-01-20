// ========================================
// ZAMIEŃ CAŁY PLIK: app/api/chat/route.ts
// DODANE LOGI DIAGNOSTYCZNE
// ========================================

/**
 * API Route: /api/chat
 * Dyrygent - orkiestruje wywołania AI w odpowiedniej kolejności
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
  getPreferences,
  savePreference,
  deletePreference,
} from '@/lib/supabase';
import { isGenerateAction, CHAT_HISTORY_LIMIT } from '@/lib/constants';
import type { ChatRequest, ChatMessage, ChatMode, MessageSender, AIContext, Preference } from '@/lib/types';

// ============================================
// WZORCE KOMEND PREFERENCJI
// ============================================

const PREFERENCE_PATTERNS = {
  // Zapisz preferencję - wszystkie warianty polskich znaków
  save: /zapami[eę]taj\s+(.+)/i,
  saveAlt: /zapamietaj\s+(.+)/i,
  saveAlt2: /zapamiętaj\s+(.+)/i,
  saveEn: /remember\s+(?:that)?\s*(.+)/i,
  // Usuń preferencję
  delete: /zapomnij\s+(?:o)?\s*(.+)/i,
  deleteEn: /forget\s+(?:about)?\s*(.+)/i,
  // Pokaż preferencje - więcej wariantów
  list: /(?:jakie|poka[zż]|wy[sś]wietl|pokaz|wyswietl|pokazpreferencje)\s*(?:masz)?\s*(?:moje)?\s*(?:preferencje)?/i,
  listAlt: /(?:poka[zż]|pokaz)\s*preferencje/i,
  listEn: /(?:show|list|what are)\s*(?:my)?\s*preferences/i,
};

/**
 * Sprawdza czy wiadomość to komenda preferencji
 */
function detectPreferenceCommand(message: string): {
  type: 'save' | 'delete' | 'list' | null;
  content?: string;
} {
  // ========== DEBUG LOGS ==========
  console.log('========== PREFERENCE DEBUG ==========');
  console.log('Raw message:', message);
  console.log('Message length:', message.length);
  
  // Test każdego wzorca
  console.log('Testing SAVE pattern:', PREFERENCE_PATTERNS.save.test(message));
  console.log('Testing SAVE ALT pattern:', PREFERENCE_PATTERNS.saveAlt.test(message));
  console.log('Testing SAVE ALT2 pattern:', PREFERENCE_PATTERNS.saveAlt2.test(message));
  console.log('Testing SAVE EN pattern:', PREFERENCE_PATTERNS.saveEn.test(message));
  console.log('Testing LIST pattern:', PREFERENCE_PATTERNS.list.test(message));
  console.log('Testing LIST ALT pattern:', PREFERENCE_PATTERNS.listAlt.test(message));
  console.log('Testing DELETE pattern:', PREFERENCE_PATTERNS.delete.test(message));
  console.log('======================================');
  // ========== END DEBUG ==========

  // Sprawdź listowanie
  if (PREFERENCE_PATTERNS.list.test(message) || PREFERENCE_PATTERNS.listAlt.test(message) || PREFERENCE_PATTERNS.listEn.test(message)) {
    console.log('>>> DETECTED: LIST command');
    return { type: 'list' };
  }

  // Sprawdź zapisywanie - wszystkie warianty
  let match = PREFERENCE_PATTERNS.save.exec(message);
  if (match) {
    console.log('>>> DETECTED: SAVE command (main)', match[1]);
    return { type: 'save', content: match[1].trim() };
  }
  
  match = PREFERENCE_PATTERNS.saveAlt.exec(message);
  if (match) {
    console.log('>>> DETECTED: SAVE command (alt)', match[1]);
    return { type: 'save', content: match[1].trim() };
  }
  
  match = PREFERENCE_PATTERNS.saveAlt2.exec(message);
  if (match) {
    console.log('>>> DETECTED: SAVE command (alt2)', match[1]);
    return { type: 'save', content: match[1].trim() };
  }
  
  match = PREFERENCE_PATTERNS.saveEn.exec(message);
  if (match) {
    console.log('>>> DETECTED: SAVE command (en)', match[1]);
    return { type: 'save', content: match[1].trim() };
  }

  // Sprawdź usuwanie
  match = PREFERENCE_PATTERNS.delete.exec(message);
  if (match) {
    console.log('>>> DETECTED: DELETE command', match[1]);
    return { type: 'delete', content: match[1].trim() };
  }
  match = PREFERENCE_PATTERNS.deleteEn.exec(message);
  if (match) {
    console.log('>>> DETECTED: DELETE command (en)', match[1]);
    return { type: 'delete', content: match[1].trim() };
  }

  console.log('>>> NO PREFERENCE COMMAND DETECTED');
  return { type: null };
}

/**
 * Parsuje preferencję z tekstu użytkownika
 */
function parsePreference(content: string): { category: string; key: string; value: string } {
  console.log('Parsing preference content:', content);
  
  // Wzorce dla różnych typów preferencji
  const patterns = [
    { regex: /nazywam\s+si[eę]\s+(.+)/i, category: 'personal', keyPrefix: 'imię' },
    { regex: /mam\s+na\s+imi[eę]\s+(.+)/i, category: 'personal', keyPrefix: 'imię' },
    { regex: /jestem\s+(.+)/i, category: 'personal', keyPrefix: 'kim_jestem' },
    { regex: /prefer[uę]\s+(.+)/i, category: 'general', keyPrefix: 'preferuje' },
    { regex: /lubi[ęe]\s+(.+)/i, category: 'general', keyPrefix: 'lubi' },
    { regex: /u[zż]ywam\s+(.+)/i, category: 'tech', keyPrefix: 'używa' },
    { regex: /pracuj[eę]?\s+(?:w|z|nad)?\s*(.+)/i, category: 'work', keyPrefix: 'pracuje_z' },
    { regex: /m[oó]j\s+(?:ulubiony|preferowany)?\s*(.+)\s+to\s+(.+)/i, category: 'general', keyPrefix: 'ulubiony' },
    { regex: /odpowiadaj\s+(?:mi)?\s+(?:po)?\s*(.+)/i, category: 'communication', keyPrefix: 'język_odpowiedzi' },
    { regex: /my\s+(?:preferred|favorite)?\s*(.+)\s+is\s+(.+)/i, category: 'general', keyPrefix: 'favorite' },
    { regex: /i\s+(?:prefer|like|use)\s+(.+)/i, category: 'general', keyPrefix: 'prefers' },
    { regex: /my\s+name\s+is\s+(.+)/i, category: 'personal', keyPrefix: 'name' },
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern.regex);
    if (match) {
      console.log('Matched pattern:', pattern.keyPrefix, match);
      if (match.length >= 3) {
        return {
          category: pattern.category,
          key: `${match[1].trim().toLowerCase().replace(/\s+/g, '_')}`,
          value: match[2].trim(),
        };
      } else {
        return {
          category: pattern.category,
          key: pattern.keyPrefix,
          value: match[1].trim(),
        };
      }
    }
  }

  // Domyślne parsowanie
  const words = content.split(/\s+/);
  const key = words.slice(0, Math.min(3, words.length)).join('_').toLowerCase();
  const value = content;

  console.log('Default parsing - key:', key, 'value:', value);
  return { category: 'general', key, value };
}

/**
 * Formatuje listę preferencji
 */
function formatPreferencesList(preferences: Preference[]): string {
  if (preferences.length === 0) {
    return '📋 Nie mam jeszcze zapisanych żadnych preferencji.\n\nMożesz mi powiedzieć np.:\n- "Zapamiętaj że nazywam się Piotr"\n- "Zapamiętaj że preferuję dark mode"\n- "Zapamiętaj że używam React i TypeScript"';
  }

  const grouped: Record<string, Preference[]> = {};
  for (const pref of preferences) {
    if (!grouped[pref.category]) {
      grouped[pref.category] = [];
    }
    grouped[pref.category].push(pref);
  }

  let result = '📋 **Twoje zapisane preferencje:**\n\n';

  for (const [category, prefs] of Object.entries(grouped)) {
    const categoryName = {
      general: '🎯 Ogólne',
      tech: '💻 Technologia',
      work: '💼 Praca',
      communication: '💬 Komunikacja',
      ui: '🎨 Interfejs',
      personal: '👤 Osobiste',
    }[category] || `📁 ${category}`;

    result += `${categoryName}:\n`;
    for (const pref of prefs) {
      result += `  • ${pref.key}: ${pref.value}\n`;
    }
    result += '\n';
  }

  result += '\n💡 Możesz powiedzieć "zapomnij o [nazwa]" aby usunąć preferencję.';

  return result;
}

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
    const action = isGenerateAction(message) ? 'generate' : 'discuss';
    const enhancedMessage = action === 'generate'
      ? `${message}\n\n[TRYB GENEROWANIA - napisz pełny, działający kod]`
      : message;

    // 1. CLAUDE
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

    if (mode === 'solo') {
      sendEvent({ type: 'done' });
      close();
      return;
    }

    // 2. GPT
    sendEvent({ type: 'typing', sender: 'gpt' });

    let gptResponse: string;
    try {
      gptResponse = await callGPT(message, claudeResponse, context.history, context);
    } catch (error) {
      console.error('GPT error:', error);
      gptResponse = 'Nie mogłem przeanalizować kodu w tym momencie.';
    }

    sendEvent({ type: 'message', sender: 'gpt', content: gptResponse });
    await saveChatMessage(conversationId, 'gpt', gptResponse);

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

    // 3. GEMINI
    sendEvent({ type: 'typing', sender: 'gemini' });

    let geminiResponse: string;
    try {
      geminiResponse = await callGemini(message, claudeResponse, gptResponse, context.history, context);
    } catch (error) {
      console.error('Gemini error:', error);
      geminiResponse = 'Nie mogłem przeanalizować UI/UX w tym momencie.';
    }

    sendEvent({ type: 'message', sender: 'gemini', content: geminiResponse });
    await saveChatMessage(conversationId, 'gemini', geminiResponse);

    // 4. CLAUDE final
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
    const { conversation_id, message, mode, project_id, projectContext, context: requestContext } = body;

    console.log('========== CHAT API REQUEST ==========');
    console.log('Message received:', message);
    console.log('Mode:', mode);
    console.log('=======================================');

    // Walidacja
    if (!message || !mode) {
      return new Response(
        JSON.stringify({ error: 'Brak wymaganych pól: message, mode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pobierz preferencje użytkownika
    const preferences = await getPreferences();
    console.log('Current preferences count:', preferences.length);

    // Utwórz lub użyj istniejącej konwersacji
    let conversationId = conversation_id;
    if (!conversationId) {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      const conversation = await createConversation(title, mode, project_id);
      conversationId = conversation.id;
    }

    // Zapisz wiadomość użytkownika
    await saveChatMessage(conversationId, 'user', message);

    // ========== SPRAWDŹ PREFERENCJE ==========
    const preferenceCommand = detectPreferenceCommand(message);
    console.log('Preference command result:', preferenceCommand);
    // =========================================

    // Utwórz SSE stream
    const { stream, sendEvent, close } = createSSEStream();

    // Wyślij conversation_id na początku
    sendEvent({ type: 'conversation_id', id: conversationId });

    // Obsłuż komendy preferencji
    if (preferenceCommand.type) {
      console.log('>>> HANDLING PREFERENCE COMMAND:', preferenceCommand.type);
      try {
        let responseMessage = '';

        switch (preferenceCommand.type) {
          case 'list': {
            responseMessage = formatPreferencesList(preferences);
            break;
          }
          case 'save': {
            if (preferenceCommand.content) {
              const parsed = parsePreference(preferenceCommand.content);
              console.log('>>> SAVING PREFERENCE:', parsed);
              await savePreference(parsed.category, parsed.key, parsed.value);
              responseMessage = `✅ Zapamiętałem!\n\n**${parsed.key}**: ${parsed.value}\n\nBędę o tym pamiętać w przyszłych rozmowach.`;
            } else {
              responseMessage = '❓ Nie zrozumiałem co mam zapamiętać. Spróbuj np. "Zapamiętaj że preferuję dark mode"';
            }
            break;
          }
          case 'delete': {
            if (preferenceCommand.content) {
              const keyToDelete = preferenceCommand.content.toLowerCase().replace(/\s+/g, '_');
              const prefToDelete = preferences.find(
                p => p.key.includes(keyToDelete) || p.value.toLowerCase().includes(preferenceCommand.content!.toLowerCase())
              );
              if (prefToDelete) {
                await deletePreference(prefToDelete.key);
                responseMessage = `🗑️ Usunąłem preferencję:\n\n**${prefToDelete.key}**: ${prefToDelete.value}`;
              } else {
                responseMessage = `❓ Nie znalazłem preferencji pasującej do "${preferenceCommand.content}".\n\nPowiedz "pokaż preferencje" żeby zobaczyć listę.`;
              }
            } else {
              responseMessage = '❓ Nie zrozumiałem co mam zapomnieć. Spróbuj np. "Zapomnij o dark mode"';
            }
            break;
          }
        }

        // Wyślij odpowiedź
        sendEvent({ type: 'message', sender: 'claude', content: responseMessage });
        await saveChatMessage(conversationId, 'claude', responseMessage);
        sendEvent({ type: 'done' });
        close();

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });

      } catch (error) {
        console.error('Preference command error:', error);
        sendEvent({ type: 'error', error: 'Wystąpił błąd podczas obsługi preferencji' });
        close();
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }
    }

    // Pobierz historię i kontekst
    const history = await getConversationHistory(conversationId, CHAT_HISTORY_LIMIT);
    const project = project_id ? await getProjectById(project_id) : undefined;

    const context: AIContext = {
      history,
      preferences,
      project: project || undefined,
      editorContent: requestContext?.editorContent,
      projectContext: projectContext || undefined,
    };

    // Uruchom orkiestrację
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