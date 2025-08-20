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

// Version export (derived from package.json)
import pkg from '../package.json' with { type: 'json' };
export const VERSION = pkg.version as string;
