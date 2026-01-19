/**
 * FilesList - lista plików do pobrania z Supabase Storage
 * Każdy plik: nazwa, rozmiar, przycisk pobierz
 * Przycisk "Pobierz wszystko (ZIP)"
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Download,
  FileCode,
  FileJson,
  FileText,
  File,
  Palette,
  Database,
  Globe,
  Archive,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { StorageFile } from '@/lib/types';
import { getFileExtension } from '@/lib/utils';
import { formatFileSize } from '@/lib/constants';
import { getFileDownloadUrl, downloadFile } from '@/lib/supabase';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface FilesListProps {
  files: StorageFile[];
  isLoading?: boolean;
}

// Mapowanie rozszerzeń na ikony
const getFileIcon = (filename: string) => {
  const ext = getFileExtension(filename);
  const iconMap: Record<string, React.ReactNode> = {
    tsx: <FileCode className="h-5 w-5 text-blue-400" />,
    ts: <FileCode className="h-5 w-5 text-blue-400" />,
    jsx: <FileCode className="h-5 w-5 text-yellow-400" />,
    js: <FileCode className="h-5 w-5 text-yellow-400" />,
    json: <FileJson className="h-5 w-5 text-green-400" />,
    css: <Palette className="h-5 w-5 text-pink-400" />,
    scss: <Palette className="h-5 w-5 text-pink-400" />,
    sql: <Database className="h-5 w-5 text-orange-400" />,
    html: <Globe className="h-5 w-5 text-red-400" />,
    md: <FileText className="h-5 w-5 text-gray-400" />,
  };

  return iconMap[ext] || <File className="h-5 w-5 text-muted-foreground" />;
};

export function FilesList({ files, isLoading = false }: FilesListProps) {
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Pobierz pojedynczy plik
  const handleDownloadFile = useCallback(async (file: StorageFile) => {
    setDownloadingFile(file.path);

    try {
      const url = await getFileDownloadUrl(file.path);

      // Otwórz URL w nowej karcie lub pobierz
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Pobrano: ${file.name}`);
    } catch (error) {
      console.error('Błąd pobierania pliku:', error);
      toast.error(`Nie udało się pobrać: ${file.name}`);
    } finally {
      setDownloadingFile(null);
    }
  }, []);

  // Pobierz wszystkie pliki jako ZIP
  const handleDownloadAll = useCallback(async () => {
    if (files.length === 0) return;

    setDownloadingAll(true);

    try {
      const zip = new JSZip();

      // Pobierz każdy plik i dodaj do ZIP
      for (const file of files) {
        try {
          const blob = await downloadFile(file.path);
          zip.file(file.name, blob);
        } catch (error) {
          console.error(`Błąd pobierania pliku ${file.name}:`, error);
          // Kontynuuj z pozostałymi plikami
        }
      }

      // Wygeneruj ZIP i pobierz
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'pliki.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success('Pobrano wszystkie pliki jako ZIP');
    } catch (error) {
      console.error('Błąd tworzenia ZIP:', error);
      toast.error('Nie udało się utworzyć archiwum ZIP');
    } finally {
      setDownloadingAll(false);
    }
  }, [files]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Pliki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="skeleton h-12 rounded-lg"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Brak plików
  if (files.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Pliki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Brak plików do pobrania</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Pliki ({files.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingAll}
          >
            {downloadingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Pakowanie...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Pobierz ZIP
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.path}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {getFileIcon(file.name)}
                <div className="min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownloadFile(file)}
                disabled={downloadingFile === file.path}
              >
                {downloadingFile === file.path ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default FilesList;
