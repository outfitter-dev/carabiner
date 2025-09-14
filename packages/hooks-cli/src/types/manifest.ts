/**
 * Hook manifest format
 * Similar to package.json but specific to Carabiner hooks
 */

export interface HookManifest {
  /** Hook name (e.g., "bash-validator" or "@user/custom-hook") */
  name: string;

  /** Semantic version */
  version: string;

  /** Human-readable description */
  description: string;

  /** Author name or object */
  author:
    | string
    | {
        name: string;
        email?: string;
        url?: string;
      };

  /** Source location (npm package, GitHub URL, etc.) */
  source: string;

  /** Installation timestamp */
  installedAt?: string;

  /** Other hooks this hook depends on */
  dependencies?: string[];

  /** Peer dependencies (hooks that should be installed separately) */
  peerDependencies?: string[];

  /** Hook configuration */
  config?: {
    /** Default timeout in seconds */
    timeout?: number;

    /** Events this hook handles */
    events?: Array<
      | "PreToolUse"
      | "PostToolUse"
      | "SessionStart"
      | "SessionEnd"
      | "UserPromptSubmit"
    >;

    /** Tools this hook applies to */
    tools?: string[];

    /** Whether hook can block operations */
    blocking?: boolean;
  };

  /** Files included in the hook */
  files?: {
    main: string;
    types?: string;
    schema?: string;
  };

  /** Keywords for discovery */
  tags?: string[];

  /** License */
  license?: string;

  /** Repository information */
  repository?: {
    type: string;
    url: string;
  };

  /** Example configurations */
  examples?: Array<{
    name: string;
    description: string;
    config: Record<string, any>;
  }>;
}

/**
 * Registry index format
 */
export interface RegistryIndex {
  /** Registry version */
  version: string;

  /** Last updated timestamp */
  updated: string;

  /** Available hooks */
  hooks: Array<{
    name: string;
    description: string;
    version: string;
    author: string;
    tags?: string[];
    downloads?: number;
    featured?: boolean;
  }>;

  /** Categories for browsing */
  categories: Record<string, string[]>;
}
