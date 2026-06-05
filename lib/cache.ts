/**
 * Simple in-memory cache with TTL (Time To Live)
 * Reduces Google Sheets API calls significantly
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes par défaut (au lieu de 30 secondes)

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache keys matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
    };
  }
}

// Export singleton instance
export const cache = new SimpleCache();

// Cache keys generators
export const CacheKeys = {
  // Photographes
  allPhotographers: () => 'photographers:all',
  photographer: (id: string) => `photographer:${id}`,

  // Courses
  allCourses: () => 'courses:all',
  course: (id: string) => `course:${id}`,

  // Disponibilités
  allDisponibilites: () => 'disponibilites:all',
  disponibilitesByPhotographer: (photographerId: string) => `disponibilites:photographer:${photographerId}`,
  disponibilite: (id: string) => `disponibilite:${id}`,
  disponibilitesByCourse: (courseId: string) => `disponibilites:course:${courseId}`,

  // Tarifs
  allTarifs: () => 'tarifs:all',
  tarifsByCourse: (courseId: string) => `tarifs:course:${courseId}`,
  tarif: (id: string) => `tarif:${id}`,

  // Admins
  allAdmins: () => 'admins:all',
  admin: (id: string) => `admin:${id}`,
};

// Helper function to wrap async function with cache
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  cache.set(key, data, ttl);

  return data;
}
