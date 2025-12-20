import { NextResponse } from 'next/server';
import getBigQueryCache from '@/lib/bigqueryCache';

const cache = getBigQueryCache();

/**
 * GET /api/bigquery/cache
 * Obtener estadísticas del caché
 */
export async function GET(req) {
  try {
    const stats = cache.getStats();

    return NextResponse.json({
      success: true,
      stats,
      message: 'Estadísticas del caché de BigQuery'
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del caché:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bigquery/cache
 * Limpiar el caché completamente o una entrada específica
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (key) {
      // Eliminar entrada específica
      const deleted = cache.delete(key);
      return NextResponse.json({
        success: deleted,
        message: deleted
          ? `Entrada ${key} eliminada del caché`
          : `Entrada ${key} no encontrada`
      });
    } else {
      // Limpiar todo el caché
      cache.clear();
      return NextResponse.json({
        success: true,
        message: 'Caché completamente limpiado'
      });
    }
  } catch (error) {
    console.error('Error limpiando caché:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bigquery/cache/clean
 * Limpiar solo entradas expiradas
 */
export async function POST(req) {
  try {
    const cleaned = cache.cleanExpired();

    return NextResponse.json({
      success: true,
      cleaned,
      message: `${cleaned} entradas expiradas eliminadas`,
      stats: cache.getStats()
    });
  } catch (error) {
    console.error('Error limpiando entradas expiradas:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
