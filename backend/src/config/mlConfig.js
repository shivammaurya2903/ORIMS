/**
 * ML Service Configuration & Security Contract
 * 
 * Enforces strict environment policies:
 * - In production/staging: ML_SERVICE_API_KEY must be provided, non-empty,
 *   different from known development defaults, and >= 16 characters.
 * - In development/test: Permits development default if not explicitly configured.
 */

const KNOWN_DEV_KEYS = new Set([
  'dev-ml-api-key',
  'your-ml-service-api-key',
  'default-key',
  'secret',
  'test',
]);

export function getMlConfig(env = process.env) {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const apiKey = env.ML_SERVICE_API_KEY || env.ML_API_KEY;
  const mlUrl = env.ML_SERVICE_URL || 'http://localhost:8000';
  const isProdOrStaging = nodeEnv === 'production' || nodeEnv === 'staging';

  if (isProdOrStaging) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(`[SECURITY] ML_SERVICE_API_KEY is required in ${nodeEnv} environment`);
    }
    if (KNOWN_DEV_KEYS.has(apiKey.trim())) {
      throw new Error(`[SECURITY] ML_SERVICE_API_KEY cannot use known development default in ${nodeEnv} environment`);
    }
    if (apiKey.trim().length < 16) {
      throw new Error(`[SECURITY] ML_SERVICE_API_KEY must be at least 16 characters in ${nodeEnv} environment`);
    }
  }

  return {
    url: mlUrl,
    apiKey: apiKey || 'dev-ml-api-key',
    batchSize: Math.max(1, Math.min(parseInt(env.ML_BATCH_SIZE || '50', 10), 100)),
    timeoutMs: Math.max(1000, parseInt(env.ML_TIMEOUT_MS || '8000', 10)),
    maxRetries: Math.max(0, parseInt(env.ML_MAX_RETRIES || '1', 10)),
    nodeEnv,
  };
}
