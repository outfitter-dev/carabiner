/**
 * @outfitter/hooks-config
 * Configuration management for Claude Code hooks
 */

export type {
  ConfigFormat,
  ConfigOptions,
  ExtendedHookConfiguration,
} from './config';
// Export configuration management
export {
  CONFIG_PATHS,
  ConfigError,
  ConfigManager,
  createConfigManager,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
} from './config';

// Version export (prefer env)
export const VERSION: string =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.npm_package_version) ||
  (typeof Bun !== 'undefined' && Bun.env && Bun.env.npm_package_version) ||
  '0.0.0';
