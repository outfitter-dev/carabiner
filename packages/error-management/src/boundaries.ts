/**
 * Error Boundaries
 *
 * Comprehensive error boundary system for graceful degradation
 * and fault isolation in production environments
 */

import { ErrorFactory, GrappleError } from './errors.js';
import type { HealthStatus, IGrappleError } from './types.js';
import {
  ErrorCategory as Category,
  ErrorCode as Code,
  ErrorSeverity as Severity,
} from './types.js';

/**
 * Error boundary configuration
 */
export type ErrorBoundaryConfig = {
  /** Maximum number of errors before boundary trips */
  errorThreshold: number;
  /** Time window for error counting (ms) */
  timeWindow: number;
  /** Whether to enable automatic recovery */
  autoRecover: boolean;
  /** Recovery timeout (ms) */
  recoveryTimeout: number;
  /** Custom error handler */
  onError?: (error: IGrappleError, context: ErrorBoundaryContext) => void;
  /** Custom fallback provider */
  fallbackProvider?: (context: ErrorBoundaryContext) => unknown;
  /** Health check function */
  healthCheck?: () => Promise<boolean>;
};

/**
 * Error boundary context
 */
export type ErrorBoundaryContext = {
  /** Boundary identifier */
  boundaryId: string;
  /** Component or operation name */
  name: string;
  /** Current error count */
  errorCount: number;
  /** Boundary state */
  state: ErrorBoundaryState;
  /** Last error timestamp */
  lastErrorTime?: Date;
  /** Boundary creation time */
  createdAt: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
};

/**
 * Error boundary state
 */
export enum ErrorBoundaryState {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  FAILED = 'failed',
  RECOVERING = 'recovering',
}

/**
 * Default error boundary configuration
 */
const DEFAULT_BOUNDARY_CONFIG: ErrorBoundaryConfig = {
  errorThreshold: 5,
  timeWindow: 300_000, // 5 minutes
  autoRecover: true,
  recoveryTimeout: 60_000, // 1 minute
};

/**
 * Error boundary implementation
 */
export class ErrorBoundary {
  private readonly config: ErrorBoundaryConfig;
  private readonly context: ErrorBoundaryContext;
  private readonly errors: Array<{ error: IGrappleError; timestamp: Date }> =
    [];
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    name: string,
    config: Partial<ErrorBoundaryConfig> = {},
    metadata: Record<string, unknown> = {}
  ) {
    this.config = { ...DEFAULT_BOUNDARY_CONFIG, ...config };
    this.context = {
      boundaryId: `boundary-${name}-${Date.now()}`,
      name,
      errorCount: 0,
      state: ErrorBoundaryState.HEALTHY,
      createdAt: new Date(),
      metadata,
    };
  }

  /**
   * Execute operation within error boundary
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    // Check boundary state before execution
    if (this.context.state === ErrorBoundaryState.FAILED) {
      return this.handleFailedState<T>(operationName);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      const grappleError = ErrorFactory.fromError(
        error instanceof Error ? error : new Error(String(error)),
        operationName
      );

      this.onError(grappleError);
      throw grappleError;
    }
  }

  /**
   * Handle operation when boundary is in failed state
   */
  private handleFailedState<T>(operationName?: string): T {
    // Try fallback if available
    if (this.config.fallbackProvider) {
      try {
        const fallback = this.config.fallbackProvider(this.context);
        return fallback as T;
      } catch (_fallbackError) {}
    }

    // No fallback available, throw error
    throw new GrappleError(
      `Error boundary '${this.context.name}' is in failed state`,
      Code.RUNTIME_EXCEPTION,
      Category.RUNTIME,
      Severity.ERROR,
      {
        operation: operationName,
        technicalDetails: {
          boundaryState: this.context.state,
          errorCount: this.context.errorCount,
          boundaryId: this.context.boundaryId,
        },
      }
    );
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.context.state === ErrorBoundaryState.RECOVERING) {
      this.context.state = ErrorBoundaryState.HEALTHY;
      this.clearRecoveryTimer();
    }
  }

  /**
   * Handle error occurrence
   */
  private onError(error: IGrappleError): void {
    const now = new Date();

    // Add error to history
    this.errors.push({ error, timestamp: now });
    this.context.errorCount++;
    this.context.lastErrorTime = now;

    // Clean up old errors outside time window
    this.cleanupOldErrors();

    // Call custom error handler if provided
    if (this.config.onError) {
      try {
        this.config.onError(error, this.context);
      } catch (_handlerError) {}
    }

    // Update boundary state based on error count
    this.updateBoundaryState();
  }

  /**
   * Clean up errors outside the time window
   */
  private cleanupOldErrors(): void {
    const cutoff = new Date(Date.now() - this.config.timeWindow);
    const recentErrors = this.errors.filter(
      ({ timestamp }) => timestamp > cutoff
    );

    this.errors.length = 0;
    this.errors.push(...recentErrors);
    this.context.errorCount = recentErrors.length;
  }

  /**
   * Update boundary state based on error count
   */
  private updateBoundaryState(): void {
    const recentErrorCount = this.errors.length;

    if (recentErrorCount >= this.config.errorThreshold) {
      if (this.context.state !== ErrorBoundaryState.FAILED) {
        this.context.state = ErrorBoundaryState.FAILED;

        if (this.config.autoRecover) {
          this.scheduleRecovery();
        }
      }
    } else if (
      recentErrorCount > this.config.errorThreshold / 2 &&
      this.context.state === ErrorBoundaryState.HEALTHY
    ) {
      this.context.state = ErrorBoundaryState.DEGRADED;
    }
  }

  /**
   * Schedule automatic recovery
   */
  private scheduleRecovery(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    this.recoveryTimer = setTimeout(() => {
      this.attemptRecovery();
    }, this.config.recoveryTimeout);
  }

  /**
   * Attempt recovery
   */
  private async attemptRecovery(): Promise<void> {
    this.context.state = ErrorBoundaryState.RECOVERING;

    try {
      // Run health check if available
      if (this.config.healthCheck) {
        const isHealthy = await this.config.healthCheck();

        if (isHealthy) {
          this.context.state = ErrorBoundaryState.HEALTHY;
          this.errors.length = 0;
          this.context.errorCount = 0;
        } else {
          this.scheduleRecovery();
        }
      } else {
        // No health check, assume recovery after timeout
        this.context.state = ErrorBoundaryState.HEALTHY;
        this.errors.length = 0;
        this.context.errorCount = 0;
      }
    } catch (_error) {
      this.scheduleRecovery();
    }
  }

  /**
   * Clear recovery timer
   */
  private clearRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }

  /**
   * Get boundary status
   */
  getStatus(): ErrorBoundaryContext {
    this.cleanupOldErrors();
    return { ...this.context };
  }

  /**
   * Force boundary state (for testing)
   */
  forceState(state: ErrorBoundaryState): void {
    this.context.state = state;
    if (state === ErrorBoundaryState.HEALTHY) {
      this.errors.length = 0;
      this.context.errorCount = 0;
      this.clearRecoveryTimer();
    }
  }

  /**
   * Reset boundary to healthy state
   */
  reset(): void {
    this.context.state = ErrorBoundaryState.HEALTHY;
    this.errors.length = 0;
    this.context.errorCount = 0;
    this.clearRecoveryTimer();
  }

  /**
   * Destroy boundary and cleanup resources
   */
  destroy(): void {
    this.clearRecoveryTimer();
    this.errors.length = 0;
  }
}

/**
 * Error boundary registry for managing multiple boundaries
 */
export class ErrorBoundaryRegistry {
  private static instance?: ErrorBoundaryRegistry;
  private readonly boundaries = new Map<string, ErrorBoundary>();

  static getInstance(): ErrorBoundaryRegistry {
    if (!ErrorBoundaryRegistry.instance) {
      ErrorBoundaryRegistry.instance = new ErrorBoundaryRegistry();
    }
    return ErrorBoundaryRegistry.instance;
  }

  /**
   * Create or get error boundary
   */
  createBoundary(
    name: string,
    config: Partial<ErrorBoundaryConfig> = {},
    metadata: Record<string, unknown> = {}
  ): ErrorBoundary {
    if (this.boundaries.has(name)) {
      return this.boundaries.get(name)!;
    }

    const boundary = new ErrorBoundary(name, config, metadata);
    this.boundaries.set(name, boundary);
    return boundary;
  }

  /**
   * Get existing boundary
   */
  getBoundary(name: string): ErrorBoundary | undefined {
    return this.boundaries.get(name);
  }

  /**
   * Remove boundary
   */
  removeBoundary(name: string): boolean {
    const boundary = this.boundaries.get(name);
    if (boundary) {
      boundary.destroy();
      return this.boundaries.delete(name);
    }
    return false;
  }

  /**
   * Get all boundary statuses
   */
  getAllStatuses(): Record<string, ErrorBoundaryContext> {
    const statuses: Record<string, ErrorBoundaryContext> = {};

    for (const [name, boundary] of this.boundaries) {
      statuses[name] = boundary.getStatus();
    }

    return statuses;
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): HealthStatus {
    const components: HealthStatus['components'] = {};
    let overallHealthy = true;

    for (const [name, boundary] of this.boundaries) {
      const status = boundary.getStatus();
      const healthy = status.state === ErrorBoundaryState.HEALTHY;

      components[name] = {
        healthy,
        lastCheck: new Date(),
        error: healthy
          ? undefined
          : `Boundary in ${status.state} state with ${status.errorCount} errors`,
      };

      if (!healthy) {
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      components,
      message: overallHealthy
        ? 'All error boundaries healthy'
        : 'Some error boundaries are degraded or failed',
      timestamp: new Date(),
    };
  }

  /**
   * Reset all boundaries
   */
  resetAll(): void {
    for (const boundary of this.boundaries.values()) {
      boundary.reset();
    }
  }

  /**
   * Destroy all boundaries
   */
  destroyAll(): void {
    for (const boundary of this.boundaries.values()) {
      boundary.destroy();
    }
    this.boundaries.clear();
  }
}

/**
 * Decorator function for wrapping functions with error boundary
 */
export function withErrorBoundary<TArgs extends unknown[], TReturn>(
  boundaryName: string,
  config: Partial<ErrorBoundaryConfig> = {}
) {
  const boundary = ErrorBoundaryRegistry.getInstance().createBoundary(
    boundaryName,
    config
  );

  return function decorator(
    _target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>>
  ) {
    const originalMethod = descriptor.value;

    if (!originalMethod) {
      throw new Error(`Method ${propertyKey} is not defined`);
    }

    descriptor.value = async function (
      this: any,
      ...args: TArgs
    ): Promise<TReturn> {
      return boundary.execute(
        () => originalMethod.apply(this, args),
        propertyKey
      );
    };

    return descriptor;
  };
}

/**
 * Utility function to execute code within an error boundary
 */
export async function executeWithBoundary<T>(
  operation: () => Promise<T>,
  boundaryName: string,
  config: Partial<ErrorBoundaryConfig> = {},
  operationName?: string
): Promise<T> {
  const boundary = ErrorBoundaryRegistry.getInstance().createBoundary(
    boundaryName,
    config
  );
  return boundary.execute(operation, operationName);
}
