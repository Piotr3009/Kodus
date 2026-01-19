/**
 * Hook do zarządzania historią zadań
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskFilters, TaskHistoryState } from '@/lib/types';
import { getTasks, getTaskById } from '@/lib/supabase';
import { TASK_HISTORY_LIMIT, SEARCH_DEBOUNCE } from '@/lib/constants';
import { debounce } from '@/lib/utils';

interface UseTasksReturn {
  state: TaskHistoryState;
  filters: TaskFilters;
  setFilters: (filters: TaskFilters) => void;
  selectTask: (taskId: string) => Promise<Task | null>;
  clearSelection: () => void;
  refresh: () => Promise<void>;
}

export function useTasks(initialFilters: TaskFilters = {}): UseTasksReturn {
  const [state, setState] = useState<TaskHistoryState>({
    tasks: [],
    isLoading: true,
    error: null,
    selectedTaskId: null,
  });

  const [filters, setFiltersState] = useState<TaskFilters>({
    limit: TASK_HISTORY_LIMIT,
    ...initialFilters,
  });

  // Pobieranie zadań
  const fetchTasks = useCallback(async (currentFilters: TaskFilters) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const tasks = await getTasks(currentFilters);
      setState((prev) => ({
        ...prev,
        tasks,
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Błąd pobierania zadań';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Debounced fetch dla wyszukiwania
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetch = useCallback(
    debounce((currentFilters: TaskFilters) => {
      fetchTasks(currentFilters);
    }, SEARCH_DEBOUNCE),
    [fetchTasks]
  );

  // Aktualizacja filtrów
  const setFilters = useCallback(
    (newFilters: TaskFilters) => {
      const updatedFilters = { ...filters, ...newFilters };
      setFiltersState(updatedFilters);

      // Użyj debounce tylko dla wyszukiwania tekstowego
      if (newFilters.search !== undefined && newFilters.search !== filters.search) {
        debouncedFetch(updatedFilters);
      } else {
        fetchTasks(updatedFilters);
      }
    },
    [filters, fetchTasks, debouncedFetch]
  );

  // Wybór zadania
  const selectTask = useCallback(async (taskId: string): Promise<Task | null> => {
    setState((prev) => ({ ...prev, selectedTaskId: taskId }));

    try {
      const task = await getTaskById(taskId);
      return task;
    } catch (error) {
      console.error('Błąd pobierania zadania:', error);
      return null;
    }
  }, []);

  // Czyszczenie wyboru
  const clearSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedTaskId: null }));
  }, []);

  // Odświeżanie
  const refresh = useCallback(async () => {
    await fetchTasks(filters);
  }, [fetchTasks, filters]);

  // Początkowe pobranie
  useEffect(() => {
    fetchTasks(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    filters,
    setFilters,
    selectTask,
    clearSelection,
    refresh,
  };
}

export default useTasks;
