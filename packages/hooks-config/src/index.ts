/**
 * @claude-code/hooks-config
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

// Version export
export const VERSION = '0.1.0';
