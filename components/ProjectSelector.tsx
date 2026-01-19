/**
 * ProjectSelector - dropdown do wyboru projektu
 * Pokazuje projekty z tabeli projects z oznaczeniem statusu
 */

'use client';

import { FolderOpen, Archive, CheckCircle, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project, ProjectStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  isLoading?: boolean;
  showAllOption?: boolean;
}

// Ikona statusu projektu
const StatusIcon = ({ status }: { status: ProjectStatus }) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case 'archived':
      return <Archive className="h-3 w-3 text-muted-foreground" />;
    case 'pending':
      return <Clock className="h-3 w-3 text-yellow-500" />;
    default:
      return null;
  }
};

export function ProjectSelector({
  projects,
  selectedProjectId,
  onSelect,
  isLoading = false,
  showAllOption = false,
}: ProjectSelectorProps) {
  // Grupuj projekty według statusu
  const activeProjects = projects.filter((p) => p.status === 'active');
  const archivedProjects = projects.filter((p) => p.status === 'archived');
  const pendingProjects = projects.filter((p) => p.status === 'pending');

  // Obsługa zmiany wyboru
  const handleValueChange = (value: string) => {
    if (value === 'all') {
      onSelect(null);
    } else {
      onSelect(value);
    }
  };

  // Znajdź aktualnie wybrany projekt
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  if (isLoading) {
    return (
      <div className="skeleton h-9 w-full rounded-md" />
    );
  }

  return (
    <Select
      value={selectedProjectId || 'all'}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Wybierz projekt">
            {selectedProject ? (
              <span className="flex items-center gap-2">
                <StatusIcon status={selectedProject.status} />
                {selectedProject.name}
              </span>
            ) : showAllOption ? (
              'Wszystkie projekty'
            ) : (
              'Wybierz projekt'
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {/* Opcja "Wszystkie projekty" */}
        {showAllOption && (
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              Wszystkie projekty
            </span>
          </SelectItem>
        )}

        {/* Aktywne projekty */}
        {activeProjects.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Aktywne
            </div>
            {activeProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-2">
                  <StatusIcon status={project.status} />
                  <span>{project.name}</span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Oczekujące projekty */}
        {pendingProjects.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Oczekujące
            </div>
            {pendingProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-2">
                  <StatusIcon status={project.status} />
                  <span>{project.name}</span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Zarchiwizowane projekty */}
        {archivedProjects.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Zarchiwizowane
            </div>
            {archivedProjects.map((project) => (
              <SelectItem
                key={project.id}
                value={project.id}
                className="opacity-60"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon status={project.status} />
                  <span>{project.name}</span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Brak projektów */}
        {projects.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Brak projektów
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

export default ProjectSelector;
