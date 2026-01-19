/**
 * TaskInput - komponent do wprowadzania nowego zadania
 * Zawiera: textarea na zadanie, wybór projektu, toggle trybu, przycisk wyślij
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ProjectSelector } from './ProjectSelector';
import { ModeToggle } from './ModeToggle';
import type { Project, TaskMode, TaskFormState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TaskInputProps {
  projects: Project[];
  projectsLoading?: boolean;
  onSubmit: (data: TaskFormState) => Promise<void>;
  isDisabled?: boolean;
}

export function TaskInput({
  projects,
  projectsLoading = false,
  onSubmit,
  isDisabled = false,
}: TaskInputProps) {
  // Stan formularza
  const [task, setTask] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<TaskMode>('full');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sprawdzenie czy formularz jest gotowy do wysłania
  const canSubmit = task.trim().length > 0 && !isDisabled && !isSubmitting;

  // Obsługa wysłania formularza
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      await onSubmit({
        task: task.trim(),
        project_id: projectId,
        mode,
        isSubmitting: true,
      });

      // Wyczyść pole po udanym wysłaniu
      setTask('');
    } catch (error) {
      console.error('Błąd wysyłania zadania:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, task, projectId, mode, onSubmit]);

  // Obsługa skrótów klawiaturowych
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter = wyślij
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }

      // Ctrl+K = focus na input
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }

      // Escape = blur z input
      if (e.key === 'Escape') {
        textareaRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTask(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
  };

  return (
    <div className="space-y-4">
      {/* Pole tekstowe na zadanie */}
      <div className="space-y-2">
        <Label htmlFor="task-input" className="text-muted-foreground">
          Opisz zadanie dla AI
        </Label>
        <Textarea
          ref={textareaRef}
          id="task-input"
          placeholder="Np. Stwórz komponent React do wyświetlania listy użytkowników z paginacją..."
          value={task}
          onChange={handleTextareaChange}
          disabled={isDisabled || isSubmitting}
          className={cn(
            'min-h-[100px] resize-none transition-all',
            'focus:ring-2 focus:ring-primary/50',
            isDisabled && 'opacity-50 cursor-not-allowed'
          )}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Skrót: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> aby wysłać
        </p>
      </div>

      {/* Opcje: projekt + tryb */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Wybór projektu */}
        <div className="flex-1">
          <Label className="text-muted-foreground mb-2 block">Projekt</Label>
          <ProjectSelector
            projects={projects}
            selectedProjectId={projectId}
            onSelect={setProjectId}
            isLoading={projectsLoading}
            showAllOption
          />
        </div>

        {/* Toggle trybu */}
        <div className="sm:w-auto">
          <Label className="text-muted-foreground mb-2 block">Tryb</Label>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      {/* Przycisk wyślij */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className={cn(
            'min-w-[140px] transition-all',
            canSubmit && 'hover:scale-105'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Wysyłanie...
            </>
          ) : (
            <>
              <Send />
              Wyślij zadanie
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default TaskInput;
