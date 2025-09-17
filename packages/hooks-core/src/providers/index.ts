export {
  CLAUDE_PROVIDER_METADATA,
  claudeProviderAdapter,
} from "./claude-adapter";
export {
  __clearHookProvidersForTests,
  getDefaultHookProvider,
  getHookProvider,
  listHookProviders,
  type RegisterHookProviderOptions,
  registerHookProvider,
  requireHookProvider,
  setDefaultHookProvider,
} from "./registry";
export * from "./types";

import { claudeProviderAdapter } from "./claude-adapter";
import { registerHookProvider } from "./registry";

let defaultsRegistered = false;

export type RegisterDefaultProvidersOptions = {
  readonly force?: boolean;
};

export function registerDefaultHookProviders(
  options: RegisterDefaultProvidersOptions = {}
): void {
  if (defaultsRegistered && !options.force) {
    return;
  }
  registerHookProvider(claudeProviderAdapter, {
    makeDefault: true,
    replaceExisting: true,
  });
  defaultsRegistered = true;
}

registerDefaultHookProviders();
