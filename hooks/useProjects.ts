/**
 * Hook do zarządzania projektami
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectsState } from '@/lib/types';
import { getProjects, getProjectById } from '@/lib/supabase';

interface UseProjectsReturn {
  state: ProjectsState;
  selectProject: (projectId: string | null) => void;
  getProject: (projectId: string) => Promise<Project | null>;
  refresh: () => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [state, setState] = useState<ProjectsState>({
    projects: [],
    isLoading: true,
    error: null,
    selectedProjectId: null,
  });

  // Pobieranie projektów
  const fetchProjects = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const projects = await getProjects();
      setState((prev) => ({
        ...prev,
        projects,
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Błąd pobierania projektów';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Wybór projektu
  const selectProject = useCallback((projectId: string | null) => {
    setState((prev) => ({ ...prev, selectedProjectId: projectId }));
  }, []);

  // Pobieranie pojedynczego projektu
  const getProject = useCallback(async (projectId: string): Promise<Project | null> => {
    try {
      return await getProjectById(projectId);
    } catch (error) {
      console.error('Błąd pobierania projektu:', error);
      return null;
    }
  }, []);

  // Odświeżanie
  const refresh = useCallback(async () => {
    await fetchProjects();
  }, [fetchProjects]);

  // Początkowe pobranie
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    state,
    selectProject,
    getProject,
    refresh,
  };
}

export default useProjects;
