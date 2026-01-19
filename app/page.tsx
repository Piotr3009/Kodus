/**
 * Główna strona AI Agent Dashboard
 * Layout: sidebar (historia) + main (input/output)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bot, Menu, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Komponenty
import { TaskInput } from '@/components/TaskInput';
import { StatusBar } from '@/components/StatusBar';
import { CodeOutput } from '@/components/CodeOutput';
import { FilesList } from '@/components/FilesList';
import { TaskHistory } from '@/components/TaskHistory';
import { Button } from '@/components/ui/button';

// Hooks
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTaskStream } from '@/hooks/useTaskStream';

// Typy i stałe
import type { TaskFormState, Task, StorageFile } from '@/lib/types';
import { API_ENDPOINTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  // Stan UI
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [outputCode, setOutputCode] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<StorageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Hooks do danych
  const {
    state: projectsState,
    refresh: refreshProjects,
  } = useProjects();

  const {
    state: tasksState,
    filters: taskFilters,
    setFilters: setTaskFilters,
    selectTask,
    refresh: refreshTasks,
  } = useTasks();

  // Hook SSE
  const {
    state: streamState,
    connect: connectStream,
    reset: resetStream,
  } = useTaskStream({
    onComplete: (code, files) => {
      setOutputCode(code);
      setOutputFiles(files);
      setIsProcessing(false);
      refreshTasks();
      toast.success('Zadanie zakończone pomyślnie!');
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error(`Błąd: ${error}`);
    },
  });

  // Obsługa wysłania zadania
  const handleSubmitTask = useCallback(
    async (formData: TaskFormState) => {
      try {
        setIsProcessing(true);
        setOutputCode(null);
        setOutputFiles([]);
        resetStream();

        // Wyślij request do webhook
        const response = await fetch(API_ENDPOINTS.WEBHOOK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            task: formData.task,
            project_id: formData.project_id,
            mode: formData.mode,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Błąd wysyłania zadania');
        }

        const data = await response.json();

        // Połącz ze streamem SSE
        if (data.task_id) {
          connectStream(data.task_id);
          toast.info('Zadanie wysłane, rozpoczynam przetwarzanie...');
        }
      } catch (error) {
        setIsProcessing(false);
        const message = error instanceof Error ? error.message : 'Nieznany błąd';
        toast.error(message);
        throw error;
      }
    },
    [connectStream, resetStream]
  );

  // Obsługa wyboru zadania z historii
  const handleTaskSelect = useCallback(
    async (task: Task) => {
      const fullTask = await selectTask(task.id);

      if (fullTask?.final_code) {
        setOutputCode(fullTask.final_code);
        toast.info(`Załadowano wynik: ${task.title}`);
      } else {
        setOutputCode(null);
        toast.info(`Wybrano zadanie: ${task.title}`);
      }
    },
    [selectTask]
  );

  // Obsługa skrótów klawiaturowych (globalnych)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B = toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay dla mobile gdy sidebar otwarty */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - historia zadań */}
      <aside
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-30 w-80 bg-card border-r transform transition-transform duration-200 ease-in-out flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-0'
        )}
      >
        {/* Header sidebar */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-semibold">AI Dashboard</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                refreshTasks();
                refreshProjects();
              }}
              title="Odśwież"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Historia zadań */}
        <div className="flex-1 overflow-hidden p-4">
          <TaskHistory
            tasks={tasksState.tasks}
            projects={projectsState.projects}
            selectedTaskId={tasksState.selectedTaskId}
            onTaskSelect={handleTaskSelect}
            isLoading={tasksState.isLoading}
            filters={taskFilters}
            onFiltersChange={setTaskFilters}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="flex items-center gap-4 p-4 border-b lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold">AI Agent Dashboard</span>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {/* Header desktop */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold">AI Agent Dashboard</h1>
                <p className="text-muted-foreground">
                  System multi-LLM do generowania kodu
                </p>
              </div>
            </div>
          </div>

          {/* Task Input */}
          <section className="bg-card rounded-xl border p-4 lg:p-6">
            <h2 className="text-lg font-semibold mb-4">Nowe zadanie</h2>
            <TaskInput
              projects={projectsState.projects}
              projectsLoading={projectsState.isLoading}
              onSubmit={handleSubmitTask}
              isDisabled={isProcessing}
            />
          </section>

          {/* Status Bar - pokazuj tylko podczas przetwarzania lub gdy stream aktywny */}
          {(isProcessing || streamState.isConnected || streamState.status !== 'idle') && (
            <section>
              <StatusBar
                status={streamState.status}
                iteration={streamState.currentIteration}
                maxIterations={streamState.maxIterations}
                message={streamState.message}
                elapsedTime={streamState.elapsedTime}
              />
            </section>
          )}

          {/* Wyniki - Code Output + Files */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Code Output - zajmuje 2/3 */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Wygenerowany kod</h2>
              <CodeOutput
                code={outputCode || streamState.code}
                isLoading={isProcessing && !outputCode && !streamState.code}
              />
            </div>

            {/* Files List - zajmuje 1/3 */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-semibold mb-4">Pliki</h2>
              <FilesList
                files={outputFiles.length > 0 ? outputFiles : streamState.files}
                isLoading={isProcessing && outputFiles.length === 0 && streamState.files.length === 0}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t p-4 text-center text-xs text-muted-foreground">
          <p>
            AI Agent Dashboard • Claude + GPT-4 + Gemini • Powered by N8N
          </p>
        </footer>
      </main>
    </div>
  );
}
