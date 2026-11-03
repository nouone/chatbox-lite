import { setRuntimeRegistry } from '@shared/model-registry/enrich'
import { applyRegistryOverlays } from '@shared/model-registry/legacy-overrides'
import { MODELS_DEV_SNAPSHOT } from '@shared/model-registry/snapshot.generated'
import type { ModelRegistryData } from '@shared/model-registry/types'
import platform from '@/platform'

const BLOB_KEY = 'model-registry-cache-v2'
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
/** Skip another models.dev fetch for unknown model ids after a recent attempt. */
export const UNKNOWN_MODEL_REFRESH_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

interface CacheEntry {
  data: ModelRegistryData
  timestamp: number
}

let memoryCache: ModelRegistryData | null = null
let registryVersion = 0
const listeners = new Set<() => void>()

function notifyListeners(): void {
  registryVersion += 1
  for (const listener of listeners) {
    listener()
  }
}

function applyRegistry(data: ModelRegistryData): ModelRegistryData {
  const overlaidData = applyRegistryOverlays(data)
  memoryCache = overlaidData
  setRuntimeRegistry(overlaidData)
  notifyListeners()
  return overlaidData
}

async function readBlobCache(): Promise<CacheEntry | null> {
  try {
    const cached = await platform.getStoreBlob(BLOB_KEY)
    if (!cached) return null
    return JSON.parse(cached) as CacheEntry
  } catch {
    return null
  }
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_EXPIRY_MS
}

/**
 * Get the best available registry data synchronously.
 * Lookup chain: memory cache → build-time snapshot.
 * Blob cache is loaded asynchronously via prefetchModelRegistry() on startup.
 */
export function getRegistrySync(): ModelRegistryData {
  if (memoryCache) return memoryCache
  return applyRegistryOverlays(MODELS_DEV_SNAPSHOT)
}

/**
 * Get registry data, triggering a fetch if the 7-day catalog cache is stale.
 * A still-valid catalog is returned as-is. Lookups for a missing model id call
 * `requestUnknownModelRegistryRefresh()`.
 */
export async function getRegistry(): Promise<ModelRegistryData> {
  if (memoryCache) return memoryCache

  // Cold start: try to load from platform blob storage
  const cached = await readBlobCache()
  if (cached) {
    const overlaidData = applyRegistry(cached.data)
    if (isCacheValid(cached)) {
      return overlaidData
    }
  }

  // Cache stale or missing — fetch with fallback to sync data
  return fetchAndUpdateRegistry(cached?.data ?? MODELS_DEV_SNAPSHOT)
}

/**
 * Fetch fresh data from models.dev and update all caches.
 * Deduplicates concurrent calls.
 */
/** Lite uses its bundled catalog and local cache; model discovery uses configured providers. */
export function fetchAndUpdateRegistry(
  fallbackData: ModelRegistryData = getRegistrySync()
): Promise<ModelRegistryData> {
  return Promise.resolve(applyRegistry(fallbackData))
}

/**
 * Prefetch registry data in the background on app startup.
 * Loads from platform blob storage first, then fetches if stale.
 */
export async function prefetchModelRegistry(): Promise<void> {
  const cached = await readBlobCache()
  if (cached) {
    applyRegistry(cached.data)
    if (isCacheValid(cached)) {
      return
    }
  }

  fetchAndUpdateRegistry(cached?.data ?? MODELS_DEV_SNAPSHOT).catch((error: unknown) => {
    console.error('[model-registry] Prefetch failed:', error)
  })
}

/**
 * Fetch models.dev even when the 7-day catalog cache is still valid.
 * Used when a lookup misses a model id (newly published models, custom ids).
 * In-flight fetches are joined; a recent attempt is cooled down so unknown
 * ids do not hit the network on every request.
 */
export function requestUnknownModelRegistryRefresh(): Promise<ModelRegistryData> | null {
  return null
}

/**
 * Force refresh the registry data, ignoring cache.
 * Used when user explicitly requests a refresh (e.g., Fetch Models button).
 */
export async function forceRefreshRegistry(): Promise<ModelRegistryData> {
  const cached = await readBlobCache()
  return fetchAndUpdateRegistry(memoryCache ?? cached?.data ?? MODELS_DEV_SNAPSHOT)
}

export function subscribeRegistry(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRegistryVersion(): number {
  return registryVersion
}
