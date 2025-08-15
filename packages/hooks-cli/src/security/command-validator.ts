/**
 * Command validation and sanitization utilities
 * Provides comprehensive security validation for CLI commands and hook execution
 */

import { SecurityValidationError } from '@outfitter/hooks-validators';

/**
 * Command security configuration
 */
export interface CommandSecurityConfig {
  /** Maximum command length */
  maxLength: number;
  /** Allowed command prefixes */
  allowedPrefixes: Set<string>;
  /** Blocked command patterns */
  blockedPatterns: RegExp[];
  /** Allowed executables */
  allowedExecutables: Set<string>;
  /** Environment restrictions */
  environmentMode: 'development' | 'production' | 'test';
  /** Enable strict validation */
  strictMode: boolean;
}

/**
 * Default command security configuration
 */
export const DEFAULT_COMMAND_CONFIG: CommandSecurityConfig = {
  maxLength: 2048,
  allowedPrefixes: new Set([
    'bun',
    'npm',
    'yarn',
    'pnpm',
    'node',
    'deno',
    'python',
    'python3',
    'pip',
    'git',
    'echo',
    'ls',
    'cat',
    'head',
    'tail',
    'grep',
    'find',
    'sort',
    'uniq',
    'wc',
    'awk',
    'sed',
    'jq',
    'curl',
    'wget'
  ]),
  blockedPatterns: [
    // System destruction commands
    /\brm\s+-rf\s+[\/~\$]/,
    /\bsudo\s+(rm|dd|mkfs|fdisk|shutdown|reboot)/,
    /\b(rm|rmdir)\s+.*[\/~]/,
    /\bchmod\s+777\s+[\/~]/,
    /\bchown\s+.*[\/~]/,
    
    // Process manipulation
    /\bkill(all)?\s+-9\s+(1|\$\$)/,
    /\bpkill\s+-f/,
    /\bnohup\s+.*&/,
    
    // Network security risks
    /\b(curl|wget)\s+.*\|\s*(sh|bash|zsh|fish)/,
    /\bnc\s+.*-e\s*(sh|bash)/,
    /\btelnet\s+.*;\s*(sh|bash)/,
    
    // File system manipulation
    />\s*\/dev\/(null|zero|random|urandom|sda|sdb)/,
    /\bmount\s+.*\/dev/,
    /\bumount\s+-f/,
    /\bchattr\s+[+-][ai]/,
    
    // Privilege escalation
    /\bsu\s+-/,
    /\bsudo\s+(su|passwd|visudo)/,
    /\busermod\s+.*sudo/,
    /\bpasswd\s+(?!--help|--version)/,
    
    // System information gathering
    /\/etc\/(passwd|shadow|hosts|ssh)/,
    /\/proc\/(self|pid|sys)/,
    /\/sys\/(class|bus|devices)/,
    
    // Code execution patterns
    /\beval\s*[\(\[]/,
    /\bexec\s*[\(\[]/,
    /\$\([^)]*[\|\;]/,
    /`[^`]*[\|\;]/,
    
    // Environment manipulation
    /\bexport\s+(PATH|LD_LIBRARY_PATH|HOME)=/,
    /\bunset\s+(PATH|HOME|USER)/,
    
    // Package management risks
    /\bnpm\s+(install|i)\s+.*-g.*\|\|/,
    /\bpip\s+install\s+.*--user.*&&/,
    /\byarn\s+add\s+.*--global.*\|\|/,
    
    // Git security risks
    /\bgit\s+clone\s+.*\|\s*(sh|bash)/,
    /\bgit\s+config\s+--global\s+core\.autocrlf/,
    /\bgit\s+remote\s+add\s+.*http:/,
  ],
  allowedExecutables: new Set([
    'bun', 'node', 'npm', 'yarn', 'pnpm', 'deno',
    'python', 'python3', 'pip', 'pip3',
    'git', 'gh', 'hub',
    'ls', 'cat', 'head', 'tail', 'echo', 'printf',
    'grep', 'egrep', 'fgrep', 'rg',
    'find', 'locate',
    'sort', 'uniq', 'wc', 'cut', 'tr',
    'awk', 'sed', 'jq', 'yq',
    'curl', 'wget',
    'tar', 'gzip', 'gunzip', 'zip', 'unzip',
    'diff', 'patch',
    'make', 'cmake',
    'docker', 'docker-compose',
    'kubectl', 'helm'
  ]),
  environmentMode: 'development',
  strictMode: true
};

/**
 * Production-specific blocked patterns (more restrictive)
 */
const PRODUCTION_BLOCKED_PATTERNS = [
  // Publishing and deployment
  /\bnpm\s+(publish|unpublish)/,
  /\byarn\s+publish/,
  /\bpnpm\s+publish/,
  /\bgit\s+push.*origin.*(main|master|prod|release)/,
  
  // Infrastructure commands
  /\bdocker\s+(push|run.*--privileged|exec.*-it)/,
  /\bkubectl\s+(apply|delete|create).*prod/,
  /\bterraform\s+(apply|destroy|plan).*prod/,
  /\baws\s+.*delete/,
  /\bgcloud\s+.*delete/,
  /\baz\s+.*delete/,
  
  // Database operations
  /\bpsql\s+.*drop/i,
  /\bmysql\s+.*drop/i,
  /\bmongo\s+.*drop/i,
  /\bredis-cli\s+.*flushall/i,
];

/**
 * Command validator class
 */
export class CommandValidator {
  private config: CommandSecurityConfig;

  constructor(config: Partial<CommandSecurityConfig> = {}) {
    this.config = { ...DEFAULT_COMMAND_CONFIG, ...config };
  }

  /**
   * Validate command string for security issues
   */
  validateCommand(command: string): void {
    if (!command || typeof command !== 'string') {
      throw new SecurityValidationError(
        'Command must be a non-empty string',
        'commandValidation',
        'critical'
      );
    }

    // Remove null bytes and control characters
    const sanitized = this.sanitizeCommand(command);
    if (sanitized !== command) {
      throw new SecurityValidationError(
        'Command contains invalid control characters',
        'commandValidation',
        'critical'
      );
    }

    // Check command length
    if (command.length > this.config.maxLength) {
      throw new SecurityValidationError(
        `Command exceeds maximum length (${this.config.maxLength} characters)`,
        'commandValidation',
        'medium'
      );
    }

    // Parse and validate command structure
    const commandParts = this.parseCommand(command);
    this.validateCommandStructure(commandParts);

    // Check against blocked patterns
    this.checkBlockedPatterns(command);

    // Environment-specific validation
    this.validateEnvironmentRestrictions(command);

    // Strict mode validations
    if (this.config.strictMode) {
      this.validateStrictMode(command, commandParts);
    }
  }

  /**
   * Sanitize command string
   */
  private sanitizeCommand(command: string): string {
    // Remove null bytes and dangerous control characters
    return command
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // Remove control chars except \t, \n, \r
      .trim();
  }

  /**
   * Parse command into structured components
   */
  private parseCommand(command: string): {
    executable: string;
    args: string[];
    pipes: string[];
    redirections: string[];
    backgrounded: boolean;
    chained: boolean;
  } {
    const result: {
      executable: string;
      args: string[];
      pipes: string[];
      redirections: string[];
      backgrounded: boolean;
      chained: boolean;
    } = {
      executable: '',
      args: [],
      pipes: [],
      redirections: [],
      backgrounded: false,
      chained: false
    };

    // Check for dangerous patterns first
    result.backgrounded = /&\s*$/.test(command);
    result.chained = /[;&|]{2}/.test(command);

    // Extract pipes
    if (command.includes('|')) {
      result.pipes = command.split('|').map(part => part.trim());
    }

    // Extract redirections
    const redirectionPattern = /[<>]{1,2}/g;
    const redirections = command.match(redirectionPattern) || [];
    if (redirections.length > 0) {
      result.redirections = redirections as string[];
    }

    // Parse main command
    const mainCommand = (command.split(/[|;&]/)[0] ?? '').trim();
    const parts = mainCommand ? mainCommand.split(/\s+/) : [];
    
    if (parts.length > 0) {
      if (parts[0]) {
        result.executable = parts[0] as string;
      }
      result.args = parts.slice(1) as string[];
    }

    return result;
  }

  /**
   * Validate command structure
   */
  private validateCommandStructure(commandParts: ReturnType<typeof this.parseCommand>): void {
    // Validate executable
    if (!commandParts.executable) {
      throw new SecurityValidationError(
        'Command must have an executable',
        'commandStructure',
        'high'
      );
    }

    // Check if executable is allowed
    if (this.config.strictMode && !this.config.allowedExecutables.has(commandParts.executable)) {
      throw new SecurityValidationError(
        `Executable not in allowed list: ${commandParts.executable}`,
        'commandStructure',
        'high'
      );
    }

    // Check for dangerous command chaining
    if (commandParts.chained) {
      throw new SecurityValidationError(
        'Command chaining with && or || is not allowed',
        'commandStructure',
        'critical'
      );
    }

    // Check for background execution
    if (commandParts.backgrounded) {
      throw new SecurityValidationError(
        'Background command execution (&) is not allowed',
        'commandStructure',
        'high'
      );
    }

    // Validate pipes
    if (commandParts.pipes.length > 3) {
      throw new SecurityValidationError(
        'Too many command pipes (maximum 3 allowed)',
        'commandStructure',
        'medium'
      );
    }

    // Check dangerous pipe targets
    for (const pipe of commandParts.pipes) {
      if (/\b(sh|bash|zsh|fish|eval|exec)\b/.test(pipe)) {
        throw new SecurityValidationError(
          'Piping to shell interpreters is not allowed',
          'commandStructure',
          'critical'
        );
      }
    }

    // Validate redirections
    for (const redirect of commandParts.redirections) {
      if (redirect.includes('>') && commandParts.args.some(arg => 
        arg.includes('/dev/') || arg.includes('/proc/') || arg.includes('/sys/')
      )) {
        throw new SecurityValidationError(
          'Redirecting to system devices/pseudo-filesystems is not allowed',
          'commandStructure',
          'critical'
        );
      }
    }
  }

  /**
   * Check command against blocked patterns
   */
  private checkBlockedPatterns(command: string): void {
    // Check default blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(command)) {
        throw new SecurityValidationError(
          `Command matches blocked pattern: ${pattern.source}`,
          'blockedPattern',
          'critical'
        );
      }
    }

    // Check production-specific patterns
    if (this.config.environmentMode === 'production') {
      for (const pattern of PRODUCTION_BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
          throw new SecurityValidationError(
            `Command blocked in production environment: ${pattern.source}`,
            'productionBlocked',
            'critical'
          );
        }
      }
    }
  }

  /**
   * Validate environment-specific restrictions
   */
  private validateEnvironmentRestrictions(command: string): void {
    switch (this.config.environmentMode) {
      case 'production':
        this.validateProductionCommand(command);
        break;
      case 'development':
        this.validateDevelopmentCommand(command);
        break;
      case 'test':
        this.validateTestCommand(command);
        break;
    }
  }

  /**
   * Validate production environment commands
   */
  private validateProductionCommand(command: string): void {
    // Block sudo in production
    if (/\bsudo\b/.test(command)) {
      throw new SecurityValidationError(
        'sudo commands are blocked in production environment',
        'productionSafety',
        'critical'
      );
    }

    // Block package installations without explicit approval
    if (/\b(npm|yarn|pnpm|pip)\s+(install|add|i)\b/.test(command) && 
        !command.includes('--production')) {
      throw new SecurityValidationError(
        'Package installations must use --production flag in production',
        'productionSafety',
        'high'
      );
    }

    // Block file modifications in sensitive directories
    if (/\b(rm|mv|cp|touch|mkdir)\b/.test(command) && 
        /\/(etc|usr|bin|boot|root|home)/.test(command)) {
      throw new SecurityValidationError(
        'System directory modifications blocked in production',
        'productionSafety',
        'critical'
      );
    }
  }

  /**
   * Validate development environment commands
   */
  private validateDevelopmentCommand(command: string): void {
    // More permissive but still check for dangerous patterns
    if (/\brm\s+-rf\s+\//.test(command)) {
      throw new SecurityValidationError(
        'Recursive deletion of root directory blocked',
        'developmentSafety',
        'critical'
      );
    }
  }

  /**
   * Validate test environment commands
   */
  private validateTestCommand(_command: string): void {
    // Most permissive for testing, but still check critical patterns
    // Tests may need broader permissions
  }

  /**
   * Validate strict mode restrictions
   */
  private validateStrictMode(command: string, commandParts: ReturnType<typeof this.parseCommand>): void {
    // No network access in strict mode
    const networkCommands = ['curl', 'wget', 'nc', 'telnet', 'ssh', 'scp', 'rsync'];
    if (networkCommands.includes(commandParts.executable)) {
      throw new SecurityValidationError(
        `Network commands blocked in strict mode: ${commandParts.executable}`,
        'strictMode',
        'high'
      );
    }

    // No package management in strict mode
    const packageManagers = ['npm', 'yarn', 'pnpm', 'pip', 'pip3'];
    if (packageManagers.includes(commandParts.executable) && 
        commandParts.args.some(arg => ['install', 'add', 'i'].includes(arg))) {
      throw new SecurityValidationError(
        'Package installations blocked in strict mode',
        'strictMode',
        'high'
      );
    }

    // No environment variable manipulation
    if (/\b(export|unset|env)\s+\w+=/i.test(command)) {
      throw new SecurityValidationError(
        'Environment variable manipulation blocked in strict mode',
        'strictMode',
        'medium'
      );
    }

    // No shell variable substitution with command execution
    if (/\$\([^)]*[`|&;<>]/g.test(command) || /`[^`]*[|&;<>]/g.test(command)) {
      throw new SecurityValidationError(
        'Complex shell substitutions blocked in strict mode',
        'strictMode',
        'high'
      );
    }
  }

  /**
   * Check if command prefix is allowed
   */
  isAllowedPrefix(command: string): boolean {
    const executable = command.trim().split(/\s+/)[0] || '';
    return this.config.allowedPrefixes.has(executable);
  }

  /**
   * Get current configuration
   */
  getConfig(): CommandSecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CommandSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Create command validator for specific environment
   */
  static forEnvironment(env: 'development' | 'production' | 'test', strictMode = false): CommandValidator {
    const config: Partial<CommandSecurityConfig> = {
      environmentMode: env,
      strictMode
    };

    if (env === 'production') {
      config.strictMode = true;
      config.allowedExecutables = new Set([
        'bun', 'node', 'npm', 'git', 
        'echo', 'cat', 'ls', 'grep', 'jq'
      ]);
    }

    return new CommandValidator(config);
  }
}

/**
 * Validate CLI command (utility function)
 */
export function validateCommand(
  command: string, 
  environment: 'development' | 'production' | 'test' = 'development',
  strictMode = true
): void {
  const validator = CommandValidator.forEnvironment(environment, strictMode);
  validator.validateCommand(command);
}

/**
 * Sanitize and validate hook command
 */
export function validateHookCommand(command: string): string {
  const validator = new CommandValidator({
    environmentMode: 'development',
    strictMode: true
  });

  validator.validateCommand(command);
  
  // Additional hook-specific validation
  if (!command.startsWith('bun ') && !command.startsWith('node ')) {
    throw new SecurityValidationError(
      'Hook commands must start with "bun" or "node"',
      'hookValidation',
      'high'
    );
  }

  return command;
}

/**
 * Create secure command builder
 */
export function createSecureCommand(executable: string, args: string[], validator?: CommandValidator): string {
  const instance = validator || new CommandValidator();
  
  // Validate executable
  if (!instance.getConfig().allowedExecutables.has(executable)) {
    throw new SecurityValidationError(
      `Executable not allowed: ${executable}`,
      'commandBuilder',
      'high'
    );
  }

  // Sanitize arguments
  const sanitizedArgs = args.map(arg => {
    // Basic sanitization - remove dangerous characters
    const sanitized = arg.replace(/[`$(){}[\]|&;<>]/g, '');
    if (sanitized !== arg) {
      throw new SecurityValidationError(
        `Argument contains dangerous characters: ${arg}`,
        'commandBuilder',
        'high'
      );
    }
    return `"${sanitized}"`;
  });

  const command = `${executable} ${sanitizedArgs.join(' ')}`.trim();
  instance.validateCommand(command);
  
  return command;
}
