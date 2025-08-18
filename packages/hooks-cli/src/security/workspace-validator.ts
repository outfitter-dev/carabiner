/**
 * Workspace validation and security utilities
 * Provides comprehensive workspace boundary enforcement and path validation
 */

import { existsSync, lstatSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { SecurityValidationError } from '@outfitter/hooks-validators';

/**
 * Workspace security configuration
 */
export type WorkspaceSecurityConfig = {
  /** Maximum allowed directory depth for operations */
  maxDepth: number;
  /** Allowed file extensions for operations */
  allowedExtensions: Set<string>;
  /** Blocked file patterns */
  blockedPatterns: RegExp[];
  /** Allowed directories within workspace */
  allowedDirectories: Set<string>;
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Enable strict path validation */
  strictMode: boolean;
};

/**
 * Default workspace security configuration
 */
export const DEFAULT_WORKSPACE_CONFIG: WorkspaceSecurityConfig = {
  maxDepth: 10,
  allowedExtensions: new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.json',
    '.md',
    '.txt',
    '.yml',
    '.yaml',
    '.toml',
    '.env.example',
    '.gitignore',
    '.editorconfig',
  ]),
  blockedPatterns: [
    // System files
    /^\/etc\//,
    /^\/bin\//,
    /^\/usr\//,
    /^\/root\//,
    /^\/home\/[^/]+\/\.(ssh|config|bash_history|zsh_history)/,

    // Security-sensitive files
    /\.(pem|key|p12|pfx|crt|cer)$/i,
    /\.(env\.prod|env\.production)$/i,
    /secrets?\.json$/i,
    /credentials?\.json$/i,
    /keystore$/i,
    /truststore$/i,

    // Temporary and cache files
    /^\/tmp\//,
    /^\/var\/tmp\//,
    /node_modules\//,
    /\.git\//,
    /\.cache\//,
    /\.temp\//,

    // Build artifacts
    /dist\//,
    /build\//,
    /coverage\//,

    // Hidden system files (but allow .claude directory and its contents)
    /^\/.*\/\.(git|cache|temp|npm|yarn|pnpm|eslint|babel|webpack|next|nuxt|vite)\//,
    /\/\.(bash_history|zsh_history|viminfo|ssh|config|profile|bashrc|zshrc)($|\/)/,
  ],
  allowedDirectories: new Set([
    '.claude',
    'hooks',
    'src',
    'lib',
    'scripts',
    'docs',
    'examples',
    'test',
    'tests',
    '__tests__',
    'spec',
    '__spec__',
  ]),
  maxFileSize: 10_485_760, // 10MB
  strictMode: true,
};

/**
 * Workspace validator class
 */
export class WorkspaceValidator {
  private readonly workspaceRoot: string;
  private config: WorkspaceSecurityConfig;
  private readonly normalizedRoot: string;

  constructor(
    workspacePath: string,
    config: Partial<WorkspaceSecurityConfig> = {}
  ) {
    // Set config first
    this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...config };
    // Then normalize and validate workspace path
    this.workspaceRoot = this.validateWorkspacePath(workspacePath);
    this.normalizedRoot = resolve(this.workspaceRoot);
  }

  /**
   * Validate and sanitize workspace path
   */
  private validateWorkspacePath(path: string): string {
    if (!path || typeof path !== 'string') {
      throw new SecurityValidationError(
        'Workspace path must be a non-empty string',
        'workspaceValidation',
        'critical'
      );
    }

    // Remove null bytes and control characters
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Security validation requires control char detection
    const sanitized = path.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    if (sanitized !== path) {
      throw new SecurityValidationError(
        'Workspace path contains invalid characters',
        'workspaceValidation',
        'critical'
      );
    }

    // Resolve path and check for directory traversal attempts
    const resolved = resolve(sanitized);

    // Prevent access to system directories, but allow temp directories for testing
    const systemPaths = ['/etc', '/bin', '/usr', '/root'];
    const blockedVarPaths = [
      '/var/log',
      '/var/lib',
      '/var/cache',
      '/var/run',
      '/var/spool',
    ];

    if (systemPaths.some((sysPath) => resolved.startsWith(sysPath))) {
      throw new SecurityValidationError(
        `Access to system directory blocked: ${resolved}`,
        'workspaceValidation',
        'critical'
      );
    }

    // Block specific /var paths but allow temp directories
    if (blockedVarPaths.some((varPath) => resolved.startsWith(varPath))) {
      throw new SecurityValidationError(
        `Access to system directory blocked: ${resolved}`,
        'workspaceValidation',
        'critical'
      );
    }

    // Special handling for /tmp - allow subdirectories but not /tmp itself
    if (resolved === '/tmp') {
      throw new SecurityValidationError(
        'Direct access to /tmp not allowed, use subdirectory instead',
        'workspaceValidation',
        'high'
      );
    }

    // Ensure directory exists and is actually a directory
    if (!existsSync(resolved)) {
      throw new SecurityValidationError(
        `Workspace directory does not exist: ${resolved}`,
        'workspaceValidation',
        'high'
      );
    }

    const stats = lstatSync(resolved);
    if (!stats.isDirectory()) {
      throw new SecurityValidationError(
        `Workspace path is not a directory: ${resolved}`,
        'workspaceValidation',
        'high'
      );
    }

    // Check for symbolic links in strict mode
    if (this.config.strictMode && stats.isSymbolicLink()) {
      throw new SecurityValidationError(
        'Symbolic links not allowed in strict mode',
        'workspaceValidation',
        'high'
      );
    }

    return resolved;
  }

  /**
   * Validate file path within workspace boundaries
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Security validation requires comprehensive checks
  validateFilePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      throw new SecurityValidationError(
        'File path must be a non-empty string',
        'pathValidation',
        'critical'
      );
    }

    // Remove null bytes and control characters
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Security validation requires control char detection
    const sanitized = filePath.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    if (sanitized !== filePath) {
      throw new SecurityValidationError(
        'File path contains invalid characters',
        'pathValidation',
        'critical'
      );
    }

    // Check for command injection patterns in file paths
    const dangerousPatterns = [
      /[;&|`$()]/, // Command injection characters
      /\$\{[^}]*\}/, // Variable substitution
      /\$\([^)]*\)/, // Command substitution
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filePath)) {
        throw new SecurityValidationError(
          `File path contains dangerous characters: ${filePath}`,
          'pathValidation',
          'critical'
        );
      }
    }

    // Check for advanced directory traversal patterns
    const traversalPatterns = [
      /\.{4,}/, // Multiple dots like ....
      /__proto__/i, // Prototype pollution
      /constructor/i, // Constructor access
      /prototype/i, // Prototype access
    ];

    for (const pattern of traversalPatterns) {
      if (pattern.test(filePath)) {
        throw new SecurityValidationError(
          `Directory traversal attempt detected: ${filePath}`,
          'pathValidation',
          'critical'
        );
      }
    }

    // Check for Unicode attacks and encoding issues
    const unicodePatterns = [
      /[\u202e\u202d\u200e\u200f]/, // Unicode direction override
      /[\u00a0\u2000-\u200f\u2028-\u202f]/, // Various Unicode spaces and controls
      /[\ufeff]/, // Zero Width No-Break Space (BOM)
    ];

    for (const pattern of unicodePatterns) {
      if (pattern.test(filePath)) {
        throw new SecurityValidationError(
          `Unicode encoding attack detected: ${filePath}`,
          'pathValidation',
          'critical'
        );
      }
    }

    // Resolve path relative to workspace
    const resolved = resolve(this.normalizedRoot, sanitized);

    // Critical security check: ensure path is within workspace
    const rel = relative(this.normalizedRoot, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new SecurityValidationError(
        `Path traversal attempt detected: ${filePath} resolves to ${resolved}`,
        'pathValidation',
        'critical'
      );
    }

    // Check against blocked patterns
    const relativePath = relative(this.normalizedRoot, resolved);
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(resolved) || pattern.test(relativePath)) {
        // Allow .claude directory and its contents
        const relNorm = relativePath.replace(/\\/g, '/');
        if (relNorm === '.claude' || relNorm.startsWith('.claude/')) {
          continue;
        }
        throw new SecurityValidationError(
          `Access to blocked path: ${filePath}`,
          'pathValidation',
          'high'
        );
      }
    }

    // Validate directory depth
    const depth = relativePath.split(/[\\/]+/).filter(Boolean).length - 1;
    if (depth > this.config.maxDepth) {
      throw new SecurityValidationError(
        `Path exceeds maximum depth (${this.config.maxDepth}): ${filePath}`,
        'pathValidation',
        'medium'
      );
    }

    // Validate file extension if file exists
    if (existsSync(resolved)) {
      const stats = lstatSync(resolved);

      // Check file size
      if (stats.isFile() && stats.size > this.config.maxFileSize) {
        throw new SecurityValidationError(
          `File exceeds maximum size (${this.config.maxFileSize} bytes): ${filePath}`,
          'pathValidation',
          'medium'
        );
      }

      // Check allowed extensions for files
      if (stats.isFile()) {
        const extension = (() => {
          // Handle special cases like .env.example
          for (const allowedExt of this.config.allowedExtensions) {
            if (resolved.endsWith(allowedExt)) {
              return allowedExt;
            }
          }
          // Standard extension extraction
          const lastDot = resolved.lastIndexOf('.');
          return lastDot >= 0 ? resolved.slice(lastDot) : '';
        })();

        if (extension && !this.config.allowedExtensions.has(extension)) {
          throw new SecurityValidationError(
            `File extension not allowed: ${extension} (file: ${filePath})`,
            'pathValidation',
            'medium'
          );
        }
      }

      // Check for symbolic links in strict mode
      if (this.config.strictMode && stats.isSymbolicLink()) {
        throw new SecurityValidationError(
          `Symbolic links not allowed in strict mode: ${filePath}`,
          'pathValidation',
          'high'
        );
      }
    }

    return resolved;
  }

  /**
   * Validate directory path within workspace boundaries
   */
  validateDirectoryPath(dirPath: string): string {
    const resolved = this.validateFilePath(dirPath);

    // Check if directory is in allowed list for strict mode
    if (this.config.strictMode) {
      const relativePath = relative(this.normalizedRoot, resolved);
      const topLevelDir = relativePath.split('/')[0];

      if (topLevelDir && !this.config.allowedDirectories.has(topLevelDir)) {
        throw new SecurityValidationError(
          `Directory not in allowed list: ${dirPath}`,
          'pathValidation',
          'medium'
        );
      }
    }

    return resolved;
  }

  /**
   * Create secure file path within workspace
   */
  createSecurePath(pathSegments: string[]): string {
    // Validate each segment
    for (const segment of pathSegments) {
      if (!segment || typeof segment !== 'string') {
        throw new SecurityValidationError(
          'All path segments must be non-empty strings',
          'pathValidation',
          'critical'
        );
      }

      // Check for directory traversal attempts (but allow double dots in filenames like file..txt)
      if (
        segment === '..' ||
        segment === '.' ||
        segment.includes('/') ||
        segment.includes('\\') ||
        segment.startsWith('../') ||
        segment.endsWith('/..')
      ) {
        throw new SecurityValidationError(
          `Invalid path segment: ${segment}`,
          'pathValidation',
          'critical'
        );
      }

      // Remove null bytes and control characters
      const sanitized = segment.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
      if (sanitized !== segment) {
        throw new SecurityValidationError(
          `Path segment contains invalid characters: ${segment}`,
          'pathValidation',
          'critical'
        );
      }
    }

    const combinedPath = join(...pathSegments);
    return this.validateFilePath(combinedPath);
  }

  /**
   * Get workspace root path
   */
  getWorkspaceRoot(): string {
    return this.normalizedRoot;
  }

  /**
   * Check if path is within workspace
   */
  isWithinWorkspace(filePath: string): boolean {
    try {
      this.validateFilePath(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get relative path from workspace root
   */
  getRelativePath(filePath: string): string {
    const resolved = this.validateFilePath(filePath);
    return relative(this.normalizedRoot, resolved);
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<WorkspaceSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current security configuration
   */
  getConfig(): WorkspaceSecurityConfig {
    return { ...this.config };
  }
}

/**
 * Create workspace validator instance
 */
export function createWorkspaceValidator(
  workspacePath: string,
  config?: Partial<WorkspaceSecurityConfig>
): WorkspaceValidator {
  return new WorkspaceValidator(workspacePath, config);
}

/**
 * Validate workspace path (utility function)
 */
export function validateWorkspacePath(
  workspacePath: string,
  filePath?: string
): { workspaceRoot: string; resolvedPath?: string } {
  const validator = createWorkspaceValidator(workspacePath, {
    strictMode: true,
  });

  const result: { workspaceRoot: string; resolvedPath?: string } = {
    workspaceRoot: validator.getWorkspaceRoot(),
  };

  if (filePath) {
    result.resolvedPath = validator.validateFilePath(filePath);
  }

  return result;
}

/**
 * Utility to sanitize user input paths
 */
export function sanitizeUserPath(userPath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new SecurityValidationError(
      'Path must be a non-empty string',
      'pathSanitization',
      'critical'
    );
  }

  // Remove null bytes, control characters, and normalize path separators
  return userPath
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
    .replace(/[\\]+/g, '/') // Normalize path separators
    .replace(/\/+/g, '/') // Remove duplicate slashes
    .replace(/\/\./g, '/') // Remove single dots
    .trim();
}
