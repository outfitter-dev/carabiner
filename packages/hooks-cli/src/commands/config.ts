/**
 * Config command - Manages hook configuration
 */

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigManager } from '@claude-code/hooks-config';
import { BaseCommand, type CliConfig } from '../cli';

// Regex constants for better performance
const BUN_RUN_REGEX = /bun run (.+?)(\s|$)/;

export class ConfigCommand extends BaseCommand {
  name = 'config';
  description = 'Manage hook configuration';
  usage = 'config <action> [options]';
  options = {
    '--output, -o': 'Output file path',
    '--format, -f': 'Output format (json, js, ts)',
    '--help, -h': 'Show help',
  };

  async execute(args: string[], config: CliConfig): Promise<void> {
    const { values, positionals } = this.parseArgs(args, {
      help: { type: 'boolean', short: 'h' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
    });

    if (values.help) {
      this.showHelp();
      this.showConfigHelp();
      return;
    }

    const [action] = positionals;
    if (!action) {
      throw new Error('Action is required. Usage: config <action>');
    }

    const configManager = new ConfigManager(config.workspacePath);

    try {
      switch (action.toLowerCase()) {
        case 'show':
          await this.showConfig(configManager, config.verbose);
          break;
        case 'validate':
          await this.validateConfig(configManager);
          break;
        case 'generate-settings':
          await this.generateClaudeSettings(configManager, values.output);
          break;
        case 'enable':
          await this.enableHook(configManager, positionals.slice(1));
          break;
        case 'disable':
          await this.disableHook(configManager, positionals.slice(1));
          break;
        case 'set-timeout':
          await this.setTimeout(configManager, positionals.slice(1));
          break;
        case 'export':
          await this.exportConfig(configManager, values.output, values.format);
          break;
        default:
          throw new Error(`Unknown config action: ${action}`);
      }
    } catch (error) {
      throw new Error(
        `Config command failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Show additional help for config command
   */
  private showConfigHelp(): void {
    process.stdout.write(`
Configuration commands:
  show           Display current configuration
  validate       Validate configuration files
  export         Export configuration to a file

Examples:
  claude-hooks config show
  claude-hooks config validate
  claude-hooks config export --format yaml --output my-config.yaml
`);
  }

  /**
   * Show current configuration
   */
  private async showConfig(
    configManager: ConfigManager,
    verbose: boolean
  ): Promise<void> {
    const config = await configManager.load();

    this.showConfigExtends(config);
    this.showHookConfigurations(config, verbose);
    this.showConfigVariables(config);

    if (verbose) {
      this.showEnvironmentOverrides(config);
    }
  }

  /**
   * Show configuration extends
   */
  private showConfigExtends(config: Record<string, unknown>): void {
    const configExtends = config.extends;
    if (Array.isArray(configExtends) && configExtends.length > 0) {
      process.stdout.write(`Extends: ${configExtends.join(', ')}\n`);
    }
  }

  /**
   * Show hook configurations
   */
  private showHookConfigurations(
    config: Record<string, unknown>,
    verbose: boolean
  ): void {
    for (const [event, eventConfig] of Object.entries(config)) {
      if (this.shouldSkipConfigEntry(event)) {
        continue;
      }

      if (eventConfig && typeof eventConfig === 'object') {
        if ('command' in eventConfig) {
          this.displayHookConfig(
            eventConfig as Record<string, unknown>,
            '  ',
            verbose
          );
        } else {
          this.displayToolSpecificConfigs(eventConfig, verbose);
        }
      }
    }
  }

  /**
   * Display tool-specific configurations
   */
  private displayToolSpecificConfigs(
    eventConfig: Record<string, unknown>,
    verbose: boolean
  ): void {
    for (const [_tool, toolConfig] of Object.entries(eventConfig)) {
      if (toolConfig && typeof toolConfig === 'object') {
        this.displayHookConfig(
          toolConfig as Record<string, unknown>,
          '    ',
          verbose
        );
      }
    }
  }

  /**
   * Check if config entry should be skipped
   */
  private shouldSkipConfigEntry(event: string): boolean {
    return (
      event.startsWith('$') ||
      ['templates', 'variables', 'environments'].includes(event)
    );
  }

  /**
   * Show configuration variables
   */
  private showConfigVariables(config: Record<string, unknown>): void {
    const variables = config.variables;
    if (
      variables &&
      typeof variables === 'object' &&
      Object.keys(variables).length > 0
    ) {
      process.stdout.write('Variables:\n');
      for (const [key, value] of Object.entries(variables)) {
        process.stdout.write(`  ${key}: ${value}\n`);
      }
    }
  }

  /**
   * Show environment overrides
   */
  private showEnvironmentOverrides(config: Record<string, unknown>): void {
    const environments = config.environments;
    if (environments && typeof environments === 'object') {
      process.stdout.write('Environment overrides:\n');
      for (const [env, overrides] of Object.entries(environments)) {
        process.stdout.write(`  ${env}: ${JSON.stringify(overrides)}\n`);
      }
    }
  }

  /**
   * Display hook configuration details
   */
  private displayHookConfig(
    config: Record<string, unknown>,
    indent: string,
    verbose: boolean
  ): void {
    const status = config.enabled !== false ? '✅ enabled' : '❌ disabled';
    process.stdout.write(`${indent}Status: ${status}\n`);

    if (verbose) {
      if (config.detached !== undefined) {
        process.stdout.write(
          `${indent}Detached: ${config.detached ? 'yes' : 'no'}\n`
        );
      }
      if (config.timeout) {
        process.stdout.write(`${indent}Timeout: ${config.timeout}ms\n`);
      }
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfig(configManager: ConfigManager): Promise<void> {
    try {
      const config = await configManager.load({ validate: true });
      const warnings = await this.performConfigValidation(config);

      if (warnings > 0) {
        // Handle warnings if needed
      }
    } catch (_error) {
      process.exit(1);
    }
  }

  /**
   * Perform configuration validation and return warning count
   */
  private performConfigValidation(config: Record<string, unknown>): number {
    let warnings = 0;

    for (const [event, eventConfig] of Object.entries(config)) {
      if (this.shouldSkipConfigEntry(event)) {
        continue;
      }

      if (eventConfig && typeof eventConfig === 'object') {
        warnings += this.validateEventConfig(eventConfig, event);
      }
    }

    return warnings;
  }

  /**
   * Validate individual event configuration
   */
  private validateEventConfig(
    eventConfig: Record<string, unknown>,
    event: string
  ): number {
    let warnings = 0;

    if ('command' in eventConfig) {
      warnings += this.checkHookFile(
        eventConfig as Record<string, unknown>,
        event,
        ''
      );
    } else {
      warnings += this.validateToolConfigs(eventConfig, event);
    }

    return warnings;
  }

  /**
   * Validate tool-specific configurations
   */
  private validateToolConfigs(
    eventConfig: Record<string, unknown>,
    event: string
  ): number {
    let warnings = 0;

    for (const [tool, toolConfig] of Object.entries(eventConfig)) {
      if (
        toolConfig &&
        typeof toolConfig === 'object' &&
        'command' in toolConfig
      ) {
        warnings += this.checkHookFile(
          toolConfig as Record<string, unknown>,
          event,
          tool
        );
      }
    }

    return warnings;
  }

  /**
   * Check if hook file exists
   */
  private checkHookFile(
    hookConfig: Record<string, unknown>,
    event: string,
    tool: string
  ): number {
    const _hookName = tool ? `${event}:${tool}` : event;

    // Extract file path from bun run command
    const command = hookConfig.command;
    if (typeof command !== 'string') {
      return 0;
    }

    const bunRunMatch = command.match(BUN_RUN_REGEX);

    if (bunRunMatch?.[1]) {
      const scriptPath = bunRunMatch[1];

      if (!existsSync(scriptPath)) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * Generate Claude settings.json
   */
  private async generateClaudeSettings(
    configManager: ConfigManager,
    outputPath?: string
  ): Promise<void> {
    const _config = await configManager.load();
    const settings = configManager.generateClaudeSettings();

    const outputFile =
      outputPath ||
      join(configManager.getWorkspacePath(), '.claude', 'settings.json');

    await writeFile(outputFile, JSON.stringify(settings, null, 2));
  }

  /**
   * Enable a specific hook
   */
  private async enableHook(
    configManager: ConfigManager,
    args: string[]
  ): Promise<void> {
    if (args.length === 0) {
      throw new Error(
        'Hook identifier required. Format: <event> or <event>:<tool>'
      );
    }

    const [hookId] = args;
    if (!hookId) {
      throw new Error('Hook identifier is required');
    }
    const [event, tool] = hookId.split(':');

    await configManager.toggleHook(
      event as Record<string, unknown>,
      tool as Record<string, unknown>,
      true
    );
  }

  /**
   * Disable a specific hook
   */
  private async disableHook(
    configManager: ConfigManager,
    args: string[]
  ): Promise<void> {
    if (args.length === 0) {
      throw new Error(
        'Hook identifier required. Format: <event> or <event>:<tool>'
      );
    }

    const [hookId] = args;
    if (!hookId) {
      throw new Error('Hook identifier is required');
    }
    const [event, tool] = hookId.split(':');

    await configManager.toggleHook(
      event as Record<string, unknown>,
      tool as Record<string, unknown>,
      false
    );
  }

  /**
   * Set hook timeout
   */
  private async setTimeout(
    configManager: ConfigManager,
    args: string[]
  ): Promise<void> {
    if (args.length < 2) {
      throw new Error(
        'Hook identifier and timeout required. Usage: set-timeout <hook> <timeout>'
      );
    }

    const [hookId, timeoutStr] = args;
    if (!(hookId && timeoutStr)) {
      throw new Error('Both hook identifier and timeout are required');
    }
    const [event, tool] = hookId.split(':');
    const timeout = Number.parseInt(timeoutStr, 10);

    if (Number.isNaN(timeout) || timeout < 0) {
      throw new Error('Timeout must be a positive number');
    }

    const hookConfig = configManager.getHookConfig(
      event as Record<string, unknown>,
      tool as Record<string, unknown>
    );
    if (!hookConfig) {
      throw new Error(`Hook not found: ${hookId}`);
    }

    await configManager.setHookConfig(
      event as Record<string, unknown>,
      tool as Record<string, unknown>,
      {
        ...hookConfig,
        timeout,
      }
    );
  }

  /**
   * Export configuration
   */
  private async exportConfig(
    configManager: ConfigManager,
    outputPath?: string,
    format?: string
  ): Promise<void> {
    const config = await configManager.load();
    const exportFormat = (format || 'json') as 'json' | 'js' | 'ts';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultOutput = `hooks-config-${timestamp}.${exportFormat}`;
    const _outputFile = outputPath || defaultOutput;

    await configManager.save(config, exportFormat);
  }
}
