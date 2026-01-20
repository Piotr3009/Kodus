/**
 * API Route: /api/files/context
 * Pobiera pełny kontekst projektu dla AI
 */

import { NextResponse } from 'next/server';
import { getProjectContext } from '@/lib/files';

export async function GET() {
  try {
    const context = await getProjectContext();

    return NextResponse.json({
      context,
      loaded: true,
    });
  } catch (error) {
    console.error('Error getting project context:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Błąd pobierania kontekstu projektu' },
      { status: 500 }
    );
  }
}
