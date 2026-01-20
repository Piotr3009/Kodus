/**
 * API endpoint do czytania zawartości pliku
 * GET /api/files/read?path=ścieżka
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileContent, isPathSafe, isFileBlocked } from '@/lib/files';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    // Sprawdź czy ścieżka została podana
    if (!path) {
      return NextResponse.json(
        { error: 'Parametr "path" jest wymagany' },
        { status: 400 }
      );
    }

    // Walidacja ścieżki
    if (!isPathSafe(path)) {
      return NextResponse.json(
        { error: 'Nieprawidłowa ścieżka - dostęp zabroniony' },
        { status: 403 }
      );
    }

    // Sprawdź czy plik nie jest zablokowany
    if (isFileBlocked(path)) {
      return NextResponse.json(
        { error: 'Dostęp do tego pliku jest zabroniony ze względów bezpieczeństwa' },
        { status: 403 }
      );
    }

    const { content, size } = await readFileContent(path);

    return NextResponse.json({
      content,
      path,
      size,
    });
  } catch (error) {
    console.error('Błąd czytania pliku:', error);

    const message = error instanceof Error ? error.message : 'Nieznany błąd';

    let status = 500;
    if (message.includes('nie istnieje')) status = 404;
    if (message.includes('za duży')) status = 413;
    if (message.includes('zabroniony')) status = 403;

    return NextResponse.json({ error: message }, { status });
  }
}
