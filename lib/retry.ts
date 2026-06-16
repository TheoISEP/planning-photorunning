/**
 * Utility pour gérer les retries avec exponential backoff
 * Utilisé pour gérer les erreurs de quota Google Sheets API
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelay: 1000, // 1 seconde
  maxDelay: 30000, // 30 secondes
  backoffMultiplier: 2,
};

/**
 * Exécute une fonction avec retry et exponential backoff
 * @param fn Fonction à exécuter
 * @param options Options de retry
 * @returns Résultat de la fonction
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Vérifier si c'est une erreur de quota
      const isQuotaError =
        error.message?.includes('Quota exceeded') ||
        error.message?.includes('Rate Limit Exceeded') ||
        error.code === 429;

      // Si ce n'est pas une erreur de quota, ou si on a épuisé les retries, relancer
      if (!isQuotaError || attempt === opts.maxRetries) {
        throw error;
      }

      // Calculer le délai avec jitter (aléatoire pour éviter les thundering herds)
      const jitter = Math.random() * 0.3 * delay; // +/- 30% de jitter
      const actualDelay = Math.min(delay + jitter, opts.maxDelay);

      console.log(
        `⚠️ Quota exceeded (attempt ${attempt + 1}/${opts.maxRetries + 1}), retry dans ${Math.round(actualDelay)}ms...`
      );

      // Attendre avant de réessayer
      await new Promise(resolve => setTimeout(resolve, actualDelay));

      // Augmenter le délai pour le prochain retry
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  // Si on arrive ici, toutes les tentatives ont échoué
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Wrapper pour les appels Google Sheets API avec retry automatique
 * @param fn Fonction qui fait l'appel API
 * @param options Options de retry
 * @returns Résultat de l'appel API
 */
export async function withGoogleSheetsRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    ...options,
  });
}
