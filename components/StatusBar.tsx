/**
 * StatusBar - pasek statusu pokazujący postęp przetwarzania zadania
 * Wyświetla: który LLM pracuje, która iteracja, czas wykonania
 */

'use client';

import { useMemo } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Bot,
  Wand2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { StreamStatus } from '@/lib/types';
import {
  STATUS_MESSAGES,
  STATUS_COLORS,
  formatElapsedTime,
  MAX_ITERATIONS,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  status: StreamStatus;
  iteration: number;
  maxIterations?: number;
  message?: string;
  elapsedTime: number;
}

// Ikona dla każdego statusu
const StatusIcon = ({ status }: { status: StreamStatus }) => {
  switch (status) {
    case 'idle':
      return <Clock className="h-5 w-5" />;
    case 'claude_working':
    case 'claude_fixing':
      return <Sparkles className="h-5 w-5 animate-pulse-soft text-orange-500" />;
    case 'gpt_review':
      return <Bot className="h-5 w-5 animate-pulse-soft text-green-500" />;
    case 'gemini_review':
      return <Wand2 className="h-5 w-5 animate-pulse-soft text-blue-500" />;
    case 'done':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Loader2 className="h-5 w-5 animate-spin" />;
  }
};

export function StatusBar({
  status,
  iteration,
  maxIterations = MAX_ITERATIONS,
  message,
  elapsedTime,
}: StatusBarProps) {
  // Oblicz postęp na podstawie statusu i iteracji
  const progress = useMemo(() => {
    if (status === 'idle') return 0;
    if (status === 'done') return 100;
    if (status === 'error') return 0;

    // Każda iteracja to około 33% postępu
    const iterationProgress = ((iteration - 1) / maxIterations) * 100;

    // Dodaj postęp w ramach iteracji na podstawie statusu
    let inIterationProgress = 0;
    if (status === 'claude_working' || status === 'claude_fixing') {
      inIterationProgress = 10;
    } else if (status === 'gpt_review') {
      inIterationProgress = 20;
    } else if (status === 'gemini_review') {
      inIterationProgress = 30;
    }

    return Math.min(iterationProgress + inIterationProgress, 95);
  }, [status, iteration, maxIterations]);

  // Wiadomość do wyświetlenia
  const displayMessage = message || STATUS_MESSAGES[status];

  // Czy pokazywać animację ładowania
  const isWorking = !['idle', 'done', 'error'].includes(status);

  return (
    <div className="space-y-3 p-4 rounded-lg bg-card border">
      {/* Górny wiersz: status + czas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div>
            <p className={cn('font-medium', STATUS_COLORS[status])}>
              {displayMessage}
            </p>
            {isWorking && (
              <p className="text-xs text-muted-foreground">
                Iteracja {iteration}/{maxIterations}
              </p>
            )}
          </div>
        </div>

        {/* Czas wykonania */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-mono text-sm">
            {formatElapsedTime(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Pasek postępu */}
      {status !== 'idle' && (
        <div className="space-y-1">
          <Progress
            value={progress}
            className={cn(
              'h-2 transition-all',
              status === 'error' && 'bg-red-500/20'
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {status === 'done'
                ? 'Zakończono'
                : status === 'error'
                ? 'Błąd'
                : 'W trakcie...'}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {/* Wskaźniki LLM (aktywne/nieaktywne) */}
      {isWorking && (
        <div className="flex gap-4 pt-2 border-t border-border/50">
          {/* Claude */}
          <div
            className={cn(
              'flex items-center gap-2 transition-all',
              status === 'claude_working' || status === 'claude_fixing'
                ? 'text-orange-500'
                : 'text-muted-foreground/50'
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium">Claude</span>
            {(status === 'claude_working' || status === 'claude_fixing') && (
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            )}
          </div>

          {/* GPT */}
          <div
            className={cn(
              'flex items-center gap-2 transition-all',
              status === 'gpt_review'
                ? 'text-green-500'
                : 'text-muted-foreground/50'
            )}
          >
            <Bot className="h-4 w-4" />
            <span className="text-xs font-medium">GPT-4</span>
            {status === 'gpt_review' && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>

          {/* Gemini */}
          <div
            className={cn(
              'flex items-center gap-2 transition-all',
              status === 'gemini_review'
                ? 'text-blue-500'
                : 'text-muted-foreground/50'
            )}
          >
            <Wand2 className="h-4 w-4" />
            <span className="text-xs font-medium">Gemini</span>
            {status === 'gemini_review' && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StatusBar;
