/**
 * API Route: /api/github
 * Obsługuje operacje na repozytoriach GitHub
 *
 * GET - pobierz pliki z repo
 * POST - push zmian do repo
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  parseRepoUrl,
  getRepoInfo,
  getRepoFiles,
  getFileContent,
  createFile,
  updateFile,
  getRepoTree,
} from '@/lib/github';

// Typy dla requestów
interface PullRequest {
  repoUrl: string;
  path?: string;
}

interface PushRequest {
  repoUrl: string;
  files: Array<{
    path: string;
    content: string;
    sha?: string; // Jeśli aktualizujemy istniejący plik
  }>;
  message: string;
}

interface ConnectRequest {
  repoUrl: string;
}

/**
 * GET - pobierz pliki z repozytorium
 * Query params: repoUrl, path (optional), action (list|tree|file)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoUrl = searchParams.get('repoUrl');
    const path = searchParams.get('path') || '';
    const action = searchParams.get('action') || 'list';

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Brak parametru repoUrl' },
        { status: 400 }
      );
    }

    // Parsuj URL repozytorium
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Nieprawidłowy URL repozytorium' },
        { status: 400 }
      );
    }

    const { owner, repo, branch } = repoInfo;

    switch (action) {
      case 'info': {
        // Pobierz informacje o repozytorium
        const info = await getRepoInfo(owner, repo);
        return NextResponse.json({ success: true, data: info });
      }

      case 'tree': {
        // Pobierz całe drzewo plików
        const files = await getRepoTree(owner, repo, branch);
        return NextResponse.json({ success: true, files });
      }

      case 'file': {
        // Pobierz zawartość konkretnego pliku
        if (!path) {
          return NextResponse.json(
            { error: 'Brak parametru path dla akcji file' },
            { status: 400 }
          );
        }
        const { content, sha } = await getFileContent(owner, repo, path, branch);
        return NextResponse.json({ success: true, content, sha, path });
      }

      case 'list':
      default: {
        // Pobierz listę plików w katalogu
        const files = await getRepoFiles(owner, repo, path, branch);
        return NextResponse.json({ success: true, files });
      }
    }
  } catch (error) {
    console.error('GitHub GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Błąd pobierania z GitHub' },
      { status: 500 }
    );
  }
}

/**
 * POST - push zmian do repozytorium
 * Body: { repoUrl, files, message } lub { action: 'connect', repoUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Sprawdź czy to request połączenia
    if (body.action === 'connect') {
      const { repoUrl } = body as ConnectRequest;

      if (!repoUrl) {
        return NextResponse.json(
          { error: 'Brak parametru repoUrl' },
          { status: 400 }
        );
      }

      // Parsuj i zwaliduj URL
      const repoInfo = parseRepoUrl(repoUrl);
      if (!repoInfo) {
        return NextResponse.json(
          { error: 'Nieprawidłowy URL repozytorium' },
          { status: 400 }
        );
      }

      // Sprawdź czy mamy dostęp do repo
      try {
        const info = await getRepoInfo(repoInfo.owner, repoInfo.repo);
        return NextResponse.json({
          success: true,
          connected: true,
          repo: {
            ...repoInfo,
            name: info.name,
            fullName: info.fullName,
            defaultBranch: info.defaultBranch,
          },
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Nie można połączyć z repozytorium. Sprawdź URL i token.' },
          { status: 403 }
        );
      }
    }

    // Push plików
    const { repoUrl, files, message } = body as PushRequest;

    if (!repoUrl || !files || !message) {
      return NextResponse.json(
        { error: 'Brak wymaganych pól: repoUrl, files, message' },
        { status: 400 }
      );
    }

    // Parsuj URL repozytorium
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Nieprawidłowy URL repozytorium' },
        { status: 400 }
      );
    }

    const { owner, repo, branch } = repoInfo;
    const results: Array<{ path: string; success: boolean; sha?: string; error?: string }> = [];

    // Przetwórz każdy plik
    for (const file of files) {
      try {
        if (file.sha) {
          // Aktualizuj istniejący plik
          const result = await updateFile(owner, repo, file.path, file.content, message, file.sha, branch);
          results.push({ path: file.path, success: true, sha: result.sha });
        } else {
          // Spróbuj najpierw pobrać SHA (jeśli plik istnieje)
          try {
            const existing = await getFileContent(owner, repo, file.path, branch);
            const result = await updateFile(owner, repo, file.path, file.content, message, existing.sha, branch);
            results.push({ path: file.path, success: true, sha: result.sha });
          } catch {
            // Plik nie istnieje - stwórz nowy
            const result = await createFile(owner, repo, file.path, file.content, message, branch);
            results.push({ path: file.path, success: true, sha: result.sha });
          }
        }
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error: error instanceof Error ? error.message : 'Nieznany błąd',
        });
      }
    }

    // Sprawdź czy wszystkie pliki zostały wysłane
    const allSuccess = results.every(r => r.success);
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? `Wysłano ${files.length} plików do ${repoInfo.owner}/${repoInfo.repo}`
        : `Wysłano ${files.length - failedCount}/${files.length} plików. ${failedCount} błędów.`,
      results,
    });
  } catch (error) {
    console.error('GitHub POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Błąd wysyłania do GitHub' },
      { status: 500 }
    );
  }
}
