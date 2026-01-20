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
  // Nowe funkcje auto-save
  saveLLMResponse,
  saveDecision,
  saveBugHistory,
  savePrompt,
  saveProjectRule,
  saveTechStack,
  saveStyleGuide,
} from '@/lib/supabase';
import { isGenerateAction, CHAT_HISTORY_LIMIT } from '@/lib/constants';
import type {
  ChatRequest,
  ChatMessage,
  ChatMode,
  AIContext,
  Preference,
  AutoSavePatternType,
  AIResponseMetadata,
  LLMTarget,
  RuleCategory,
  TechCategory,
} from '@/lib/types';

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

// ============================================
// WZORCE AUTO-SAVE (wykrywanie w odpowiedziach AI)
// ============================================

const AUTO_SAVE_PATTERNS: Record<AutoSavePatternType, RegExp> = {
  decision: /(?:zdecydowałem|decyzja|wybieramy|lepszym rozwiązaniem|postanowiłem|wybieram|decyduję|będziemy używać|rekomenduj[eę]|zalecam)/i,
  bug: /(?:bug|błąd|fix|naprawiłem|problem był|rozwiązanie|naprawiono|error|issue|poprawka|debugowanie)/i,
  prompt: /(?:prompt dla|wklej do claude|użyj tego promptu|skopiuj ten prompt|prompt:)/i,
  rule: /(?:zawsze używaj|nigdy nie|preferuj[eę]|zasada|reguła|konwencja|standard|wymóg)/i,
  tech: /(?:używam|stack|framework|biblioteka|technologia|język programowania|baza danych)/i,
  feedback: /(?:\[BUG\]|\[OPTYMALIZACJA\]|\[EDGE CASE\]|\[BEST PRACTICE\]|\[UI\]|\[UX\]|\[A11Y\])/i,
};

// ============================================
// FUNKCJE WYKRYWANIA AUTO-SAVE
// ============================================

/**
 * Wykrywa wzorce w odpowiedzi AI i zwraca listę wykrytych typów
 */
function detectAutoSavePatterns(content: string): AutoSavePatternType[] {
  const detected: AutoSavePatternType[] = [];

  for (const [type, pattern] of Object.entries(AUTO_SAVE_PATTERNS)) {
    if (pattern.test(content)) {
      detected.push(type as AutoSavePatternType);
    }
  }

  return detected;
}

/**
 * Wyciąga tytuł decyzji z treści
 */
function extractDecisionTitle(content: string): string {
  // Szukaj zdania z decyzją
  const patterns = [
    /(?:zdecydowałem|wybieram|decyduję)\s+(?:się\s+)?(?:na|że|aby)?\s*(.{10,100})/i,
    /(?:lepszym rozwiązaniem|rekomenduj[eę]|zalecam)\s+(?:jest|będzie)?\s*(.{10,100})/i,
    /(?:będziemy używać|używamy)\s+(.{5,50})/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].split(/[.!?\n]/)[0].trim().slice(0, 100);
    }
  }

  return 'Decyzja architektoniczna';
}

/**
 * Wyciąga informacje o bugu
 */
function extractBugInfo(content: string): { description: string; solution: string } {
  const bugMatch = content.match(/(?:bug|błąd|problem)[\s:]+(.{10,200})/i);
  const fixMatch = content.match(/(?:fix|napraw|rozwiązan|poprawk)[\s:]+(.{10,300})/i);

  return {
    description: bugMatch ? bugMatch[1].split(/[.!?\n]/)[0].trim() : 'Bug znaleziony przez AI',
    solution: fixMatch ? fixMatch[1].split(/\n\n/)[0].trim() : content.slice(0, 500),
  };
}

/**
 * Wyciąga prompt z treści
 */
function extractPrompt(content: string): { name: string; target: LLMTarget; promptContent: string } | null {
  // Szukaj bloku kodu z promptem
  const codeBlockMatch = content.match(/```(?:prompt|text)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    const promptContent = codeBlockMatch[1].trim();
    const target: LLMTarget = content.toLowerCase().includes('codex') ? 'codex' :
                              content.toLowerCase().includes('gemini') ? 'gemini' : 'claude_code';

    return {
      name: `Prompt ${new Date().toISOString().slice(0, 10)}`,
      target,
      promptContent,
    };
  }
  return null;
}

/**
 * Wyciąga zasadę projektu
 */
function extractProjectRule(content: string): { rule: string; category: RuleCategory } | null {
  const rulePatterns = [
    { regex: /(?:zawsze używaj|zawsze stosuj)\s+(.{5,100})/i, category: 'code_style' as RuleCategory },
    { regex: /(?:nigdy nie|unikaj)\s+(.{5,100})/i, category: 'code_style' as RuleCategory },
    { regex: /(?:konwencja|standard)[\s:]+(.{10,150})/i, category: 'naming' as RuleCategory },
    { regex: /(?:architektura|wzorzec)[\s:]+(.{10,150})/i, category: 'architecture' as RuleCategory },
    { regex: /(?:test|testuj)[\s:]+(.{10,150})/i, category: 'testing' as RuleCategory },
    { regex: /(?:bezpiecze[ńn]stwo|security)[\s:]+(.{10,150})/i, category: 'security' as RuleCategory },
  ];

  for (const { regex, category } of rulePatterns) {
    const match = content.match(regex);
    if (match) {
      return {
        rule: match[1].split(/[.!?\n]/)[0].trim(),
        category,
      };
    }
  }
  return null;
}

/**
 * Wyciąga tech stack
 */
function extractTechStack(content: string, userMessage: string): { name: string; category: TechCategory }[] {
  const techItems: { name: string; category: TechCategory }[] = [];
  const combined = `${userMessage} ${content}`;

  // Mapowanie technologii na kategorie
  const techMap: Record<string, TechCategory> = {
    // Frameworki
    'react': 'framework', 'next.js': 'framework', 'nextjs': 'framework', 'vue': 'framework',
    'angular': 'framework', 'svelte': 'framework', 'nuxt': 'framework', 'remix': 'framework',
    // Biblioteki
    'tailwind': 'styling', 'chakra': 'styling', 'mui': 'styling', 'bootstrap': 'styling',
    'zustand': 'state', 'redux': 'state', 'jotai': 'state', 'recoil': 'state', 'mobx': 'state',
    'axios': 'library', 'tanstack': 'library', 'react-query': 'library', 'swr': 'library',
    // Języki
    'typescript': 'language', 'javascript': 'language', 'python': 'language', 'rust': 'language',
    // Bazy danych
    'supabase': 'database', 'postgresql': 'database', 'postgres': 'database', 'mongodb': 'database',
    'mysql': 'database', 'prisma': 'database', 'drizzle': 'database',
    // Testowanie
    'jest': 'testing', 'vitest': 'testing', 'cypress': 'testing', 'playwright': 'testing',
    // Build
    'vite': 'build', 'webpack': 'build', 'turbopack': 'build', 'esbuild': 'build',
  };

  for (const [tech, category] of Object.entries(techMap)) {
    const regex = new RegExp(`\\b${tech}\\b`, 'i');
    if (regex.test(combined)) {
      techItems.push({ name: tech.charAt(0).toUpperCase() + tech.slice(1), category });
    }
  }

  return techItems;
}

/**
 * Przetwarza odpowiedź AI i wykonuje auto-save do bazy
 */
async function processAutoSave(
  content: string,
  userMessage: string,
  llmSource: 'claude' | 'gpt' | 'gemini',
  projectId: string | undefined,
  tokensUsed: number,
  conversationId: string
): Promise<AIResponseMetadata> {
  const detectedPatterns = detectAutoSavePatterns(content);
  const autoSaved: AIResponseMetadata['autoSaved'] = [];

  console.log(`[AUTO-SAVE] Wykryto wzorce w odpowiedzi ${llmSource}:`, detectedPatterns);

  // Zawsze zapisz odpowiedź LLM
  try {
    const llmResponse = await saveLLMResponse({
      conversation_id: conversationId,
      llm_source: llmSource,
      prompt_used: userMessage.slice(0, 1000),
      response: content.slice(0, 5000),
      tokens_used: tokensUsed,
    });
    if (llmResponse) {
      autoSaved.push({ table: 'llm_responses', id: llmResponse.id, type: 'feedback' });
    }
  } catch (error) {
    console.error('[AUTO-SAVE] Błąd zapisywania LLM response:', error);
  }

  // Jeśli nie ma projectId, nie możemy zapisywać do tabel związanych z projektem
  if (!projectId) {
    return { tokensUsed, detectedPatterns, autoSaved };
  }

  // Przetwórz wykryte wzorce
  for (const patternType of detectedPatterns) {
    try {
      switch (patternType) {
        case 'decision': {
          const title = extractDecisionTitle(content);
          const decision = await saveDecision({
            project_id: projectId,
            title,
            description: content.slice(0, 500),
            reason: `Wykryte automatycznie z odpowiedzi ${llmSource}`,
          });
          if (decision) {
            autoSaved.push({ table: 'decisions', id: decision.id, type: 'decision' });
          }
          break;
        }

        case 'bug': {
          const bugInfo = extractBugInfo(content);
          const bug = await saveBugHistory({
            project_id: projectId,
            description: bugInfo.description,
            solution: bugInfo.solution,
          });
          if (bug) {
            autoSaved.push({ table: 'bugs_history', id: bug.id, type: 'bug' });
          }
          break;
        }

        case 'prompt': {
          const promptInfo = extractPrompt(content);
          if (promptInfo) {
            const prompt = await savePrompt({
              name: promptInfo.name,
              llm_target: promptInfo.target,
              content: promptInfo.promptContent,
            });
            if (prompt) {
              autoSaved.push({ table: 'prompts', id: prompt.id, type: 'prompt' });
            }
          }
          break;
        }

        case 'rule': {
          const ruleInfo = extractProjectRule(content);
          if (ruleInfo) {
            const rule = await saveProjectRule({
              project_id: projectId,
              rule: ruleInfo.rule,
              category: ruleInfo.category,
            });
            if (rule) {
              autoSaved.push({ table: 'project_rules', id: rule.id, type: 'rule' });
            }
          }
          break;
        }

        case 'tech': {
          const techItems = extractTechStack(content, userMessage);
          for (const tech of techItems) {
            const saved = await saveTechStack({
              project_id: projectId,
              name: tech.name,
              category: tech.category,
            });
            if (saved) {
              autoSaved.push({ table: 'tech_stack', id: saved.id, type: 'tech' });
            }
          }
          break;
        }

        // feedback z code review jest już obsłużony przez zapisywanie LLM response
        case 'feedback':
          break;
      }
    } catch (error) {
      console.error(`[AUTO-SAVE] Błąd przetwarzania wzorca ${patternType}:`, error);
    }
  }

  if (autoSaved.length > 0) {
    console.log(`[AUTO-SAVE] Zapisano ${autoSaved.length} elementów do bazy:`, autoSaved);
  }

  return { tokensUsed, detectedPatterns, autoSaved };
}

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

// Główna funkcja orkiestrująca AI z auto-save
async function orchestrateAI(
  sendEvent: (data: object) => void,
  close: () => void,
  conversationId: string,
  message: string,
  mode: ChatMode,
  context: AIContext,
  projectId?: string
) {
  try {
    const action = isGenerateAction(message) ? 'generate' : 'discuss';
    const enhancedMessage = action === 'generate'
      ? `${message}\n\n[TRYB GENEROWANIA - napisz pełny, działający kod]`
      : message;

    // Zbiorcze statystyki tokenów
    let totalTokens = 0;
    const allAutoSaved: AIResponseMetadata['autoSaved'] = [];

    // 1. CLAUDE
    sendEvent({ type: 'typing', sender: 'claude' });

    let claudeResult;
    try {
      claudeResult = await callClaude(enhancedMessage, context.history, context);
    } catch (error) {
      sendEvent({ type: 'error', error: `Błąd Claude: ${error instanceof Error ? error.message : 'nieznany'}` });
      close();
      return;
    }

    const claudeResponse = claudeResult.content;
    totalTokens += claudeResult.metadata.tokensUsed;

    // Auto-save dla Claude
    const claudeAutoSave = await processAutoSave(
      claudeResponse,
      message,
      'claude',
      projectId,
      claudeResult.metadata.tokensUsed,
      conversationId
    );
    allAutoSaved.push(...claudeAutoSave.autoSaved);

    sendEvent({ type: 'message', sender: 'claude', content: claudeResponse });
    await saveChatMessage(conversationId, 'claude', claudeResponse);

    if (mode === 'solo') {
      sendEvent({
        type: 'done',
        metadata: { totalTokens, autoSaved: allAutoSaved }
      });
      close();
      return;
    }

    // 2. GPT
    sendEvent({ type: 'typing', sender: 'gpt' });

    let gptResult;
    let gptResponse: string;
    try {
      gptResult = await callGPT(message, claudeResponse, context.history, context);
      gptResponse = gptResult.content;
      totalTokens += gptResult.metadata.tokensUsed;

      // Auto-save dla GPT
      const gptAutoSave = await processAutoSave(
        gptResponse,
        message,
        'gpt',
        projectId,
        gptResult.metadata.tokensUsed,
        conversationId
      );
      allAutoSaved.push(...gptAutoSave.autoSaved);
    } catch (error) {
      console.error('GPT error:', error);
      gptResponse = 'Nie mogłem przeanalizować kodu w tym momencie.';
    }

    sendEvent({ type: 'message', sender: 'gpt', content: gptResponse });
    await saveChatMessage(conversationId, 'gpt', gptResponse);

    if (mode === 'duo') {
      sendEvent({ type: 'typing', sender: 'claude' });

      let claudeSummaryResult;
      let claudeSummary: string;
      try {
        claudeSummaryResult = await callClaudeSummary(message, claudeResponse, gptResponse, context);
        claudeSummary = claudeSummaryResult.content;
        totalTokens += claudeSummaryResult.metadata.tokensUsed;

        // Auto-save dla Claude Summary
        const summaryAutoSave = await processAutoSave(
          claudeSummary,
          message,
          'claude',
          projectId,
          claudeSummaryResult.metadata.tokensUsed,
          conversationId
        );
        allAutoSaved.push(...summaryAutoSave.autoSaved);
      } catch (error) {
        claudeSummary = 'Podsumowując feedback od GPT - moja oryginalna propozycja pozostaje aktualna.';
      }

      sendEvent({ type: 'message', sender: 'claude', content: claudeSummary });
      await saveChatMessage(conversationId, 'claude', claudeSummary);

      sendEvent({
        type: 'done',
        metadata: { totalTokens, autoSaved: allAutoSaved }
      });
      close();
      return;
    }

    // 3. GEMINI
    sendEvent({ type: 'typing', sender: 'gemini' });

    let geminiResult;
    let geminiResponse: string;
    try {
      geminiResult = await callGemini(message, claudeResponse, gptResponse, context.history, context);
      geminiResponse = geminiResult.content;
      totalTokens += geminiResult.metadata.tokensUsed;

      // Auto-save dla Gemini
      const geminiAutoSave = await processAutoSave(
        geminiResponse,
        message,
        'gemini',
        projectId,
        geminiResult.metadata.tokensUsed,
        conversationId
      );
      allAutoSaved.push(...geminiAutoSave.autoSaved);
    } catch (error) {
      console.error('Gemini error:', error);
      geminiResponse = 'Nie mogłem przeanalizować UI/UX w tym momencie.';
    }

    sendEvent({ type: 'message', sender: 'gemini', content: geminiResponse });
    await saveChatMessage(conversationId, 'gemini', geminiResponse);

    // 4. CLAUDE final
    sendEvent({ type: 'typing', sender: 'claude' });

    let claudeFinalResult;
    let claudeFinal: string;
    try {
      claudeFinalResult = await callClaudeFinal(message, claudeResponse, gptResponse, geminiResponse, context);
      claudeFinal = claudeFinalResult.content;
      totalTokens += claudeFinalResult.metadata.tokensUsed;

      // Auto-save dla Claude Final
      const finalAutoSave = await processAutoSave(
        claudeFinal,
        message,
        'claude',
        projectId,
        claudeFinalResult.metadata.tokensUsed,
        conversationId
      );
      allAutoSaved.push(...finalAutoSave.autoSaved);
    } catch (error) {
      claudeFinal = 'Uwzględniając feedback od GPT i Gemini - oto finalna wersja mojej propozycji.';
    }

    sendEvent({ type: 'message', sender: 'claude', content: claudeFinal });
    await saveChatMessage(conversationId, 'claude', claudeFinal);

    // Podsumowanie
    console.log(`[ORCHESTRATE] Zakończono. Tokeny: ${totalTokens}, Auto-saved: ${allAutoSaved.length} items`);

    sendEvent({
      type: 'done',
      metadata: { totalTokens, autoSaved: allAutoSaved }
    });
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

    // Uruchom orkiestrację z projectId dla auto-save
    orchestrateAI(sendEvent, close, conversationId, message, mode, context, project_id);

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