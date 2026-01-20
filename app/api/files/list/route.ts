/**
 * API endpoint do listowania plików w katalogu
 * GET /api/files/list?path=ścieżka
 */

import { NextRequest, NextResponse } from 'next/server';
import { listDirectory, isPathSafe } from '@/lib/files';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || '.';

    // Walidacja ścieżki
    if (!isPathSafe(path)) {
      return NextResponse.json(
        { error: 'Nieprawidłowa ścieżka - dostęp zabroniony' },
        { status: 403 }
      );
    }

    const files = await listDirectory(path);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Błąd listowania plików:', error);

    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    const status = message.includes('nie istnieje') ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
