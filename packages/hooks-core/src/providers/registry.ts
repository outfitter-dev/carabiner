import type { HookProviderAdapter, HookProviderId } from "./types";

const providerRegistry = new Map<HookProviderId, HookProviderAdapter>();
let defaultProviderId: HookProviderId | null = null;

export type RegisterHookProviderOptions = {
  readonly makeDefault?: boolean;
  readonly replaceExisting?: boolean;
};

export function registerHookProvider(
  adapter: HookProviderAdapter,
  options: RegisterHookProviderOptions = {}
): void {
  const { makeDefault = false, replaceExisting = false } = options;
  if (!replaceExisting && providerRegistry.has(adapter.id)) {
    throw new Error(
      `Hook provider "${adapter.id}" is already registered. Pass { replaceExisting: true } to override.`
    );
  }

  providerRegistry.set(adapter.id, adapter);

  if (makeDefault || providerRegistry.size === 1) {
    defaultProviderId = adapter.id;
  } else if (defaultProviderId && !providerRegistry.has(defaultProviderId)) {
    defaultProviderId = adapter.id;
  }
}

export function getHookProvider(
  id: HookProviderId
): HookProviderAdapter | undefined {
  return providerRegistry.get(id);
}

export function requireHookProvider(id: HookProviderId): HookProviderAdapter {
  const provider = providerRegistry.get(id);
  if (!provider) {
    throw new Error(`Hook provider "${id}" is not registered.`);
  }
  return provider;
}

export function getDefaultHookProvider(): HookProviderAdapter | null {
  if (!defaultProviderId) {
    return null;
  }
  return providerRegistry.get(defaultProviderId) ?? null;
}

export function setDefaultHookProvider(id: HookProviderId): void {
  if (!providerRegistry.has(id)) {
    throw new Error(`Hook provider "${id}" is not registered.`);
  }
  defaultProviderId = id;
}

export function listHookProviders(): HookProviderAdapter[] {
  return Array.from(providerRegistry.values());
}

/**
 * Test utility to clear the registry. Exported but documented as internal only.
 */
export function __clearHookProvidersForTests(): void {
  providerRegistry.clear();
  defaultProviderId = null;
}
