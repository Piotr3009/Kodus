// ========================================
// ZAMIEŃ CAŁY PLIK: app/api/files/add/route.ts
// ========================================

import { NextResponse } from 'next/server';
import { getFileForContext } from '@/lib/files';
import { getGitHubFileForContext } from '@/lib/github';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path, owner, repo, branch = 'main' } = body;
    
    if (!path) {
      return NextResponse.json(
        { error: 'Brak ścieżki pliku' },
        { status: 400 }
      );
    }
    
    let content: string;
    
    if (owner && repo) {
      // Pobierz z GitHub API
      console.log(`Pobieranie pliku z GitHub: ${owner}/${repo}/${path}`);
      content = await getGitHubFileForContext(owner, repo, path, branch);
    } else {
      // Fallback: pobierz lokalnie
      console.log(`Pobieranie pliku lokalnie: ${path}`);
      content = await getFileForContext(path);
    }
    
    return NextResponse.json({ content, path });
  } catch (error) {
    console.error('Błąd pobierania pliku:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nieznany błąd' },
      { status: 500 }
    );
  }
}