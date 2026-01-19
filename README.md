# AI Agent Dashboard

Frontend Next.js 14 (App Router) dla systemu multi-LLM (Claude/GPT/Gemini) z komunikacją przez N8N webhook.

## Funkcjonalności

- **TaskInput** - wprowadzanie zadań z wyborem projektu i trybu (prosty/pełny)
- **StatusBar** - real-time status przez SSE (który LLM, która iteracja, czas)
- **CodeOutput** - Monaco Editor z wynikiem (read-only, kopiowanie, pobieranie)
- **FilesList** - lista plików z Supabase Storage (pobierz pojedynczo lub ZIP)
- **TaskHistory** - historia 20 ostatnich zadań z filtrowaniem
- **ProjectSelector** - wybór projektu z oznaczeniem statusu

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict mode)
- Tailwind CSS v4
- shadcn/ui (komponenty)
- Monaco Editor (@monaco-editor/react)
- Supabase JS Client
- Lucide React (ikony)
- Sonner (toast notifications)
- JSZip (pakowanie plików)

## Struktura projektu

```
/app
  /page.tsx              # Główna strona dashboard
  /layout.tsx            # Root layout
  /globals.css           # Style globalne + zmienne CSS
  /api
    /webhook/route.ts    # Proxy do N8N webhook
    /stream/route.ts     # SSE endpoint dla real-time statusu

/components
  /ui/                   # Komponenty shadcn/ui (button, select, etc.)
  /TaskInput.tsx         # Formularz nowego zadania
  /StatusBar.tsx         # Pasek statusu przetwarzania
  /CodeOutput.tsx        # Monaco Editor z kodem
  /FilesList.tsx         # Lista plików do pobrania
  /TaskHistory.tsx       # Historia zadań
  /ProjectSelector.tsx   # Dropdown projektów
  /ModeToggle.tsx        # Przełącznik trybu

/hooks
  /useTaskStream.ts      # Hook SSE dla real-time statusu
  /useTasks.ts           # Hook historii zadań
  /useProjects.ts        # Hook projektów

/lib
  /types.ts              # TypeScript interfaces
  /constants.ts          # Stałe aplikacji
  /supabase.ts           # Klient Supabase
  /utils.ts              # Funkcje pomocnicze
```

## Istniejące tabele Supabase

Aplikacja łączy się z istniejącymi tabelami:
- `projects` (id, name, description, repo_url, status)
- `tasks` (id, project_id, title, description, status, iteration_count, final_code)
- `task_iterations` (id, task_id, iteration_number, claude_code, gpt_feedback, gemini_feedback)
- `llm_responses` (id, task_id, llm_source, prompt_used, response, tokens_used)

Storage bucket: `artifacts`

## Instalacja

```bash
# Instalacja zależności
npm install

# Skopiuj zmienne środowiskowe
cp .env.local.example .env.local

# Uzupełnij .env.local swoimi danymi:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - N8N_WEBHOOK_URL
# - N8N_WEBHOOK_SECRET (opcjonalne)

# Uruchom dev server
npm run dev
```

## Skróty klawiaturowe

- `Ctrl+Enter` - wyślij zadanie
- `Ctrl+K` - focus na input
- `Ctrl+B` - toggle sidebar
- `Escape` - anuluj/blur

## Tryby pracy

- **Prosty** - tylko Claude generuje kod (szybciej)
- **Pełny** - Claude + GPT review + Gemini review (do 3 iteracji)

## Build

```bash
npm run build
npm run start
```

## Licencja

MIT
