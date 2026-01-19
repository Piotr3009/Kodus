/**
 * TaskHistory - lista ostatnich zadań z możliwością filtrowania
 * Kliknięcie na zadanie ładuje jego wynik do CodeOutput
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Filter,
  ChevronRight,
  History,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Task, TaskFilters, TaskStatus, Project } from '@/lib/types';
import { formatDate, truncate, cn } from '@/lib/utils';

interface TaskHistoryProps {
  tasks: Task[];
  projects: Project[];
  selectedTaskId: string | null;
  onTaskSelect: (task: Task) => void;
  isLoading?: boolean;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

// Ikona statusu zadania
const StatusIcon = ({ status }: { status: TaskStatus }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

// Etykieta statusu
const statusLabels: Record<TaskStatus, string> = {
  pending: 'Oczekuje',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  failed: 'Błąd',
};

export function TaskHistory({
  tasks,
  projects,
  selectedTaskId,
  onTaskSelect,
  isLoading = false,
  filters,
  onFiltersChange,
}: TaskHistoryProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Obsługa wyszukiwania
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, search: e.target.value });
    },
    [filters, onFiltersChange]
  );

  // Obsługa filtru projektu
  const handleProjectFilter = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        project_id: value === 'all' ? null : value,
      });
    },
    [filters, onFiltersChange]
  );

  // Obsługa filtru statusu
  const handleStatusFilter = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        status: value === 'all' ? undefined : (value as TaskStatus),
      });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Historia zadań
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && 'bg-muted')}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Wyszukiwarka */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Szukaj zadań..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      {/* Filtry (rozwijane) */}
      {showFilters && (
        <div className="space-y-2 mb-4 p-3 bg-muted/30 rounded-lg">
          {/* Filtr projektu */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Projekt</label>
            <Select
              value={filters.project_id || 'all'}
              onValueChange={handleProjectFilter}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Wszystkie projekty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie projekty</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtr statusu */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Wszystkie statusy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                <SelectItem value="completed">Zakończone</SelectItem>
                <SelectItem value="in_progress">W trakcie</SelectItem>
                <SelectItem value="pending">Oczekujące</SelectItem>
                <SelectItem value="failed">Błędy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Lista zadań */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        {isLoading ? (
          // Skeleton loading
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          // Brak wyników
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Brak zadań</p>
            <p className="text-sm">
              {filters.search || filters.project_id || filters.status
                ? 'Spróbuj zmienić filtry'
                : 'Wyślij pierwsze zadanie'}
            </p>
          </div>
        ) : (
          // Lista zadań
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  onClick={() => onTaskSelect(task)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-all',
                    'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring',
                    selectedTaskId === task.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/30 border border-transparent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon status={task.status} />
                        <span className="font-medium truncate">
                          {truncate(task.title, 40)}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {truncate(task.description, 60)}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(task.created_at || '')}</span>
                        {task.project && (
                          <>
                            <span>•</span>
                            <span className="truncate">{task.project.name}</span>
                          </>
                        )}
                        {task.iteration_count > 0 && (
                          <>
                            <span>•</span>
                            <span>{task.iteration_count} iteracji</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                        selectedTaskId === task.id && 'rotate-90'
                      )}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TaskHistory;
