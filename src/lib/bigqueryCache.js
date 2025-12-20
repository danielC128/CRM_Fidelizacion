/**
 * ========================================
 * Caché en memoria para consultas BigQuery
 * ========================================
 *
 * Reduce latencia y costos al cachear resultados de consultas frecuentes
 * Ideal para consultas de filtrado que se repiten con los mismos parámetros
 */

class BigQueryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 3600000; // 1 hora por defecto
    this.maxSize = options.maxSize || 100; // Máximo 100 entradas
    this.hits = 0;
    this.misses = 0;

    console.log(`🗄️ [CACHE] Inicializado con TTL: ${this.ttl}ms, Max size: ${this.maxSize}`);
  }

  /**
   * Genera una clave única para la consulta
   */
  generateKey(table, filters, tipoCampana, modoEnvio) {
    const key = JSON.stringify({
      table,
      filters: filters?.sort((a, b) => a.column.localeCompare(b.column)), // Ordenar para consistencia
      tipoCampana,
      modoEnvio
    });

    // Usar hash simple para keys más cortas
    return this._hashCode(key);
  }

  /**
   * Hash simple para generar keys más manejables
   */
  _hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `bq_${hash}`;
  }

  /**
   * Obtener valor del caché
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      console.log(`❌ [CACHE_MISS] Key: ${key} | Hit rate: ${this.getHitRate()}%`);
      return null;
    }

    // Verificar si expiró
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      console.log(`⏰ [CACHE_EXPIRED] Key: ${key} | Hit rate: ${this.getHitRate()}%`);
      return null;
    }

    this.hits++;
    console.log(`✅ [CACHE_HIT] Key: ${key} | Rows: ${entry.data.length} | Hit rate: ${this.getHitRate()}%`);
    return entry.data;
  }

  /**
   * Guardar valor en caché
   */
  set(key, data) {
    // Si el caché está lleno, eliminar la entrada más antigua
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log(`🗑️ [CACHE_EVICT] Eliminada entrada más antigua: ${firstKey}`);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    console.log(`💾 [CACHE_SET] Key: ${key} | Rows: ${data.length} | Size: ${this.cache.size}/${this.maxSize}`);
  }

  /**
   * Limpiar caché completo
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log(`🧹 [CACHE_CLEAR] ${size} entradas eliminadas`);
  }

  /**
   * Eliminar entrada específica
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ [CACHE_DELETE] Key eliminada: ${key}`);
    }
    return deleted;
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      ttl: this.ttl
    };
  }

  /**
   * Calcular tasa de aciertos
   */
  getHitRate() {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return ((this.hits / total) * 100).toFixed(2);
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [CACHE_CLEAN] ${cleaned} entradas expiradas eliminadas`);
    }

    return cleaned;
  }
}

// ✅ Singleton: una sola instancia del caché en toda la aplicación
let cacheInstance = null;

export function getBigQueryCache(options) {
  if (!cacheInstance) {
    cacheInstance = new BigQueryCache(options);

    // Limpiar entradas expiradas cada 10 minutos
    setInterval(() => {
      cacheInstance.cleanExpired();
    }, 600000);
  }

  return cacheInstance;
}

export default getBigQueryCache;
