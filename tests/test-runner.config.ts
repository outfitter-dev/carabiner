/**
 * Comprehensive Test Runner Configuration
 *
 * Configures test execution for different environments and scenarios,
 * with coverage targets and performance requirements.
 */

import type { TestOptions } from 'bun:test';

// Memory constants to avoid magic numbers
const BYTES_PER_KB = 1024;
const MB = BYTES_PER_KB * BYTES_PER_KB;
const HEAP_INCREASE_MB = 500;
const LEAK_THRESHOLD_MB = 50;
const MAX_HEAP_INCREASE = HEAP_INCREASE_MB * MB; // 500MB
const LEAK_THRESHOLD = LEAK_THRESHOLD_MB * MB; // 50MB

export type CarabinerTestConfig = {
  /** Coverage requirements */
  coverage: {
    /** Minimum line coverage percentage */
    minLinesCoverage: number;
    /** Minimum function coverage percentage */
    minFunctionsCoverage: number;
    /** Minimum branch coverage percentage */
    minBranchesCoverage: number;
    /** Critical paths requiring 100% coverage */
    criticalPaths: string[];
    /** Directories to exclude from coverage */
    exclude: string[];
  };

  /** Performance requirements */
  performance: {
    /** Maximum test suite runtime (ms) */
    maxSuiteRuntime: number;
    /** Maximum single test runtime (ms) */
    maxTestRuntime: number;
    /** Memory usage limits */
    memory: {
      /** Maximum heap usage increase during tests (bytes) */
      maxHeapIncrease: number;
      /** Memory leak detection threshold (bytes) */
      leakThreshold: number;
    };
  };

  /** Test categories and their execution modes */
  categories: {
    unit: TestCategory;
    integration: TestCategory;
    edgeCases: TestCategory;
    performance: TestCategory;
    errorPaths: TestCategory;
    production: TestCategory;
  };

  /** Environment-specific configurations */
  environments: {
    development: EnvironmentConfig;
    ci: EnvironmentConfig;
    production: EnvironmentConfig;
  };
};

type TestCategory = {
  /** Pattern to match test files */
  pattern: string;
  /** Timeout for tests in this category (ms) */
  timeout: number;
  /** Whether to run in parallel */
  parallel: boolean;
  /** Retry configuration */
  retries: number;
  /** Coverage requirements specific to this category */
  coverageRequired: boolean;
};

type EnvironmentConfig = {
  /** Whether to collect coverage */
  coverage: boolean;
  /** Test execution timeout (ms) */
  timeout: number;
  /** Number of concurrent test runners */
  concurrency: number;
  /** Whether to run performance tests */
  includePerformanceTests: boolean;
  /** Whether to run production scenario tests */
  includeProductionTests: boolean;
};

/**
 * Main test configuration for Carabiner monorepo
 */
export const carabinerTestConfig: CarabinerTestConfig = {
  coverage: {
    minLinesCoverage: 90,
    minFunctionsCoverage: 95,
    minBranchesCoverage: 85,
    criticalPaths: [
      'packages/hooks-core/src/runtime.ts',
      'packages/execution/src/executor.ts',
      'packages/hooks-core/src/logging/logger.ts',
      'packages/hooks-config/src/config.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      'tests/**',
      '**/__tests__/**',
      '**/__mocks__/**',
    ],
  },

  performance: {
    maxSuiteRuntime: 300_000, // 5 minutes
    maxTestRuntime: 30_000, // 30 seconds
    memory: {
      maxHeapIncrease: MAX_HEAP_INCREASE,
      leakThreshold: LEAK_THRESHOLD,
    },
  },

  categories: {
    unit: {
      pattern: '**/*.test.ts',
      timeout: 5000,
      parallel: true,
      retries: 2,
      coverageRequired: true,
    },
    integration: {
      pattern: 'tests/integration/**/*.test.ts',
      timeout: 30_000,
      parallel: false,
      retries: 1,
      coverageRequired: true,
    },
    edgeCases: {
      pattern: 'tests/edge-cases/**/*.test.ts',
      timeout: 60_000,
      parallel: true,
      retries: 0,
      coverageRequired: false,
    },
    performance: {
      pattern: 'tests/performance/**/*.test.ts',
      timeout: 120_000,
      parallel: false,
      retries: 0,
      coverageRequired: false,
    },
    errorPaths: {
      pattern: 'tests/error-paths/**/*.test.ts',
      timeout: 30_000,
      parallel: true,
      retries: 3, // Error tests can be flaky
      coverageRequired: true,
    },
    production: {
      pattern: 'tests/production/**/*.test.ts',
      timeout: 180_000,
      parallel: false,
      retries: 1,
      coverageRequired: false,
    },
  },

  environments: {
    development: {
      coverage: true,
      timeout: 60_000,
      concurrency: 4,
      includePerformanceTests: false,
      includeProductionTests: false,
    },
    ci: {
      coverage: true,
      timeout: 300_000,
      concurrency: 2,
      includePerformanceTests: true,
      includeProductionTests: true,
    },
    production: {
      coverage: false,
      timeout: 600_000,
      concurrency: 1,
      includePerformanceTests: true,
      includeProductionTests: true,
    },
  },
};

/**
 * Test environment detection
 */
export function detectTestEnvironment(): keyof CarabinerTestConfig['environments'] {
  if (process.env.CI === 'true') {
    return 'ci';
  }

  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }

  return 'development';
}

/**
 * Get configuration for current environment
 */
export function getCurrentConfig(): EnvironmentConfig {
  const env = detectTestEnvironment();
  return carabinerTestConfig.environments[env];
}

/**
 * Generate Bun test configuration
 */
export function generateBunTestConfig(): TestOptions {
  const env = getCurrentConfig();

  return {
    timeout: env.timeout,
    // Add other Bun-specific configurations as needed
  };
}

/**
 * Test execution orchestrator
 */
export class TestOrchestrator {
  private readonly config: CarabinerTestConfig;
  private readonly environment: EnvironmentConfig;

  constructor(config?: Partial<CarabinerTestConfig>) {
    this.config = { ...carabinerTestConfig, ...config };
    this.environment = getCurrentConfig();
  }

  /**
   * Get test patterns to run based on environment
   */
  getTestPatterns(): string[] {
    const patterns = ['**/*.test.ts']; // Always include unit tests

    if (this.environment.includePerformanceTests) {
      patterns.push('tests/performance/**/*.test.ts');
    }

    if (this.environment.includeProductionTests) {
      patterns.push('tests/production/**/*.test.ts');
    }

    // Always include integration and error path tests
    patterns.push('tests/integration/**/*.test.ts');
    patterns.push('tests/error-paths/**/*.test.ts');
    patterns.push('tests/edge-cases/**/*.test.ts');

    return patterns;
  }

  /**
   * Generate test execution plan
   */
  generateExecutionPlan(): TestExecutionPlan {
    const _patterns = this.getTestPatterns();

    return {
      phases: [
        {
          name: 'Unit Tests',
          pattern: '**/*.test.ts',
          timeout: this.config.categories.unit.timeout,
          parallel: this.config.categories.unit.parallel,
          retries: this.config.categories.unit.retries,
          required: true,
        },
        {
          name: 'Integration Tests',
          pattern: 'tests/integration/**/*.test.ts',
          timeout: this.config.categories.integration.timeout,
          parallel: this.config.categories.integration.parallel,
          retries: this.config.categories.integration.retries,
          required: true,
        },
        {
          name: 'Edge Cases',
          pattern: 'tests/edge-cases/**/*.test.ts',
          timeout: this.config.categories.edgeCases.timeout,
          parallel: this.config.categories.edgeCases.parallel,
          retries: this.config.categories.edgeCases.retries,
          required: false,
        },
        {
          name: 'Error Path Tests',
          pattern: 'tests/error-paths/**/*.test.ts',
          timeout: this.config.categories.errorPaths.timeout,
          parallel: this.config.categories.errorPaths.parallel,
          retries: this.config.categories.errorPaths.retries,
          required: true,
        },
        {
          name: 'Performance Tests',
          pattern: 'tests/performance/**/*.test.ts',
          timeout: this.config.categories.performance.timeout,
          parallel: this.config.categories.performance.parallel,
          retries: this.config.categories.performance.retries,
          required: false,
          condition: this.environment.includePerformanceTests,
        },
        {
          name: 'Production Scenarios',
          pattern: 'tests/production/**/*.test.ts',
          timeout: this.config.categories.production.timeout,
          parallel: this.config.categories.production.parallel,
          retries: this.config.categories.production.retries,
          required: false,
          condition: this.environment.includeProductionTests,
        },
      ],
      coverage: {
        enabled: this.environment.coverage,
        requirements: this.config.coverage,
      },
      performance: {
        maxSuiteRuntime: this.config.performance.maxSuiteRuntime,
        memoryLimits: this.config.performance.memory,
      },
    };
  }

  /**
   * Validate test results against requirements
   */
  validateResults(results: TestResults): ValidationResult {
    const validation: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
    };

    // Check coverage requirements
    if (this.environment.coverage && results.coverage) {
      const cov = results.coverage;

      if (cov.linesCovered < this.config.coverage.minLinesCoverage) {
        validation.errors.push(
          `Line coverage ${cov.linesCovered}% below minimum ${this.config.coverage.minLinesCoverage}%`
        );
      }

      if (cov.functionsCovered < this.config.coverage.minFunctionsCoverage) {
        validation.errors.push(
          `Function coverage ${cov.functionsCovered}% below minimum ${this.config.coverage.minFunctionsCoverage}%`
        );
      }

      if (cov.branchesCovered < this.config.coverage.minBranchesCoverage) {
        validation.errors.push(
          `Branch coverage ${cov.branchesCovered}% below minimum ${this.config.coverage.minBranchesCoverage}%`
        );
      }
    }

    // Check performance requirements
    if (results.performance) {
      const perf = results.performance;

      if (perf.totalRuntime > this.config.performance.maxSuiteRuntime) {
        validation.warnings.push(
          `Test suite runtime ${perf.totalRuntime}ms exceeds target ${this.config.performance.maxSuiteRuntime}ms`
        );
      }

      if (
        perf.maxMemoryIncrease > this.config.performance.memory.maxHeapIncrease
      ) {
        validation.errors.push(
          `Memory increase ${perf.maxMemoryIncrease} bytes exceeds limit ${this.config.performance.memory.maxHeapIncrease} bytes`
        );
      }
    }

    validation.passed = validation.errors.length === 0;
    return validation;
  }
}

/**
 * Test execution plan interface
 */
type TestExecutionPlan = {
  phases: TestPhase[];
  coverage: {
    enabled: boolean;
    requirements: CarabinerTestConfig['coverage'];
  };
  performance: {
    maxSuiteRuntime: number;
    memoryLimits: {
      maxHeapIncrease: number;
      leakThreshold: number;
    };
  };
};

type TestPhase = {
  name: string;
  pattern: string;
  timeout: number;
  parallel: boolean;
  retries: number;
  required: boolean;
  condition?: boolean;
};

/**
 * Test results interface
 */
type TestResults = {
  phases: PhaseResult[];
  coverage?: {
    linesCovered: number;
    functionsCovered: number;
    branchesCovered: number;
    uncoveredLines: string[];
  };
  performance?: {
    totalRuntime: number;
    maxMemoryIncrease: number;
    slowestTests: { name: string; duration: number }[];
  };
};

type PhaseResult = {
  name: string;
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  runtime: number;
  errors: string[];
};

type ValidationResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Export default configuration for use in scripts
 */
export default carabinerTestConfig;
