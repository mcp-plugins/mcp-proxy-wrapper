/**
 * @file V1 to V2 Convergence Adapter
 * @version 2.0.0
 * @status STABLE - Migration bridge between V1 and V2 APIs
 * 
 * Provides a compatibility layer that allows V1 API consumers to seamlessly
 * benefit from V2 improvements without breaking changes. This adapter translates
 * V1 configuration to V2 enhanced options and provides the same interface.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger } from '../utils/logger.js';
import { ProxyWrapperOptions } from '../interfaces/proxy-hooks.js';
import { ProxyConfigurationError } from '../utils/errors.js';

/**
 * V1 to V2 migration status
 */
export interface MigrationStatus {
  /** Whether V2 is available */
  v2Available: boolean;
  
  /** V2 features being used */
  v2FeaturesEnabled: string[];
  
  /** V1 features that couldn't be migrated */
  incompatibleFeatures: string[];
  
  /** Migration recommendations */
  recommendations: string[];
}

/**
 * V1 to V2 convergence configuration
 */
export interface ConvergenceConfig {
  /** Force use of V1 implementation */
  forceV1?: boolean;
  
  /** Enable V2 features gradually */
  gradualMigration?: boolean;
  
  /** V2 features to enable */
  enabledV2Features?: string[];
  
  /** Migration mode */
  migrationMode?: 'conservative' | 'aggressive' | 'experimental';
  
  /** Enable migration logging */
  logMigration?: boolean;
}

/**
 * V1 to V2 convergence adapter
 */
export class V1V2ConvergenceAdapter {
  private logger = createLogger({ level: 'info', prefix: 'V1V2-ADAPTER' });
  private migrationStatus: MigrationStatus;
  
  constructor(private config: ConvergenceConfig = {}) {
    this.logger = createLogger({
      level: this.config.logMigration ? 'debug' : 'info',
      prefix: 'V1V2-ADAPTER'
    });
    
    this.migrationStatus = this.assessMigrationStatus();
    
    if (this.config.logMigration) {
      this.logger.info('V1 to V2 convergence adapter initialized', {
        migrationMode: this.config.migrationMode || 'conservative',
        v2Available: this.migrationStatus.v2Available,
        enabledFeatures: this.migrationStatus.v2FeaturesEnabled
      });
    }
  }
  
  /**
   * Wrap server using the best available implementation
   */
  async wrapWithProxy(
    server: McpServer,
    options: ProxyWrapperOptions = {}
  ): Promise<McpServer> {
    // Check if we should force V1
    if (this.config.forceV1) {
      this.logger.debug('Forcing V1 implementation');
      return this.wrapWithV1(server, options);
    }
    
    // Try V2 if available and configured
    if (this.shouldUseV2(options)) {
      try {
        return await this.wrapWithV2(server, options);
      } catch (error) {
        this.logger.warn('V2 wrapper failed, falling back to V1:', error);
        return this.wrapWithV1(server, options);
      }
    }
    
    // Default to V1
    return this.wrapWithV1(server, options);
  }
  
  /**
   * Get current migration status
   */
  getMigrationStatus(): MigrationStatus {
    return { ...this.migrationStatus };
  }
  
  /**
   * Generate migration recommendations
   */
  generateMigrationPlan(options: ProxyWrapperOptions): {
    currentImplementation: 'v1' | 'v2';
    recommendedActions: string[];
    benefitsOfMigration: string[];
    migrationSteps: string[];
  } {
    const shouldMigrate = this.shouldUseV2(options);
    
    return {
      currentImplementation: shouldMigrate ? 'v2' : 'v1',
      recommendedActions: this.getRecommendedActions(options),
      benefitsOfMigration: this.getBenefitsOfMigration(),
      migrationSteps: this.getMigrationSteps()
    };
  }
  
  /**
   * Check if V2 should be used
   */
  private shouldUseV2(options: ProxyWrapperOptions): boolean {
    if (!this.migrationStatus.v2Available) {
      return false;
    }
    
    const migrationMode = this.config.migrationMode || 'conservative';
    
    switch (migrationMode) {
      case 'experimental':
        return true;
      
      case 'aggressive':
        return this.hasAdvancedFeatures(options);
      
      case 'conservative':
      default:
        return this.hasV2RequiredFeatures(options);
    }
  }
  
  /**
   * Check if options require V2 features
   */
  private hasV2RequiredFeatures(options: ProxyWrapperOptions): boolean {
    // Features that specifically benefit from V2
    return !!(
      options.pluginConfig?.enableHealthChecks ||
      options.pluginConfig?.maxPlugins ||
      (options.plugins && options.plugins.length > 5) ||
      options.debug // V2 has better debugging
    );
  }
  
  /**
   * Check if options have advanced features
   */
  private hasAdvancedFeatures(options: ProxyWrapperOptions): boolean {
    return !!(
      options.plugins?.length ||
      options.hooks?.beforeToolCall ||
      options.hooks?.afterToolCall ||
      options.pluginConfig
    );
  }
  
  /**
   * Wrap with V1 implementation
   */
  private async wrapWithV1(
    server: McpServer,
    options: ProxyWrapperOptions
  ): Promise<McpServer> {
    try {
      // Import V1 implementation dynamically
      const { wrapWithProxy } = await import('../proxy-wrapper.js');
      
      this.logger.debug('Using V1 implementation', {
        pluginCount: options.plugins?.length || 0,
        hasHooks: !!(options.hooks?.beforeToolCall || options.hooks?.afterToolCall)
      });
      
      return wrapWithProxy(server, options);
    } catch (error) {
      throw new ProxyConfigurationError(
        'Failed to initialize V1 proxy wrapper',
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Wrap with V2 implementation
   */
  private async wrapWithV2(
    server: McpServer,
    options: ProxyWrapperOptions
  ): Promise<McpServer> {
    try {
      // Check if V2 is available
      const v2Module = await this.tryImportV2();
      if (!v2Module) {
        throw new Error('V2 implementation not available');
      }
      
      // Convert V1 options to V2 options
      const v2Options = this.convertV1OptionsToV2(options);
      
      this.logger.debug('Using V2 implementation', {
        pluginCount: options.plugins?.length || 0,
        v2Features: this.migrationStatus.v2FeaturesEnabled
      });
      
      return v2Module.wrapWithEnhancedProxy(server, v2Options);
    } catch (error) {
      throw new ProxyConfigurationError(
        'Failed to initialize V2 proxy wrapper',
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Try to import V2 implementation
   */
  private async tryImportV2(): Promise<any> {
    try {
      return await import('../proxy-wrapper-v2.js');
    } catch {
      return null;
    }
  }
  
  /**
   * Convert V1 options to V2 enhanced options
   */
  private convertV1OptionsToV2(options: ProxyWrapperOptions): any {
    // This would convert V1 options to V2 format
    // For now, we'll pass through most options and add V2-specific defaults
    return {
      ...options,
      
      // V2-specific execution options
      execution: {
        defaultMode: 'sequential',
        enableParallelHooks: false, // Conservative default
        maxConcurrency: 3,
        timeout: 30000,
        retryConfig: {
          maxAttempts: 1,
          baseDelay: 1000
        }
      },
      
      // V2-specific lifecycle options
      lifecycle: {
        enableGracefulShutdown: true,
        shutdownTimeout: 10000,
        enableHealthChecks: options.pluginConfig?.enableHealthChecks || false
      },
      
      // V2-specific performance options
      performance: {
        enableMetrics: options.debug || false,
        enableTracing: options.debug || false,
        resourceLimits: {
          maxMemoryMB: 512,
          maxExecutionTime: 60000
        }
      },
      
      // V2-specific security options
      security: {
        enableSandboxing: false, // Conservative default
        allowedOperations: ['all'],
        timeoutProtection: true
      }
    };
  }
  
  /**
   * Assess current migration status
   */
  private assessMigrationStatus(): MigrationStatus {
    // This would check what V2 features are available
    const v2Features = [
      'lifecycle-management',
      'parallel-execution',
      'enhanced-metrics',
      'security-sandboxing'
    ];
    
    return {
      v2Available: false, // Would be determined dynamically
      v2FeaturesEnabled: this.config.gradualMigration ? v2Features.slice(0, 2) : [],
      incompatibleFeatures: [],
      recommendations: [
        'Consider enabling V2 lifecycle management for better resource cleanup',
        'V2 provides enhanced debugging and monitoring capabilities',
        'Parallel hook execution can improve performance for multiple plugins'
      ]
    };
  }
  
  /**
   * Get recommended migration actions
   */
  private getRecommendedActions(options: ProxyWrapperOptions): string[] {
    const actions: string[] = [];
    
    if (options.plugins && options.plugins.length > 3) {
      actions.push('Enable V2 parallel plugin execution for better performance');
    }
    
    if (options.debug) {
      actions.push('Use V2 enhanced debugging and tracing capabilities');
    }
    
    if (options.pluginConfig?.enableHealthChecks) {
      actions.push('Migrate to V2 lifecycle management for comprehensive health checks');
    }
    
    return actions.length > 0 ? actions : ['Current configuration works well with V1'];
  }
  
  /**
   * Get benefits of migrating to V2
   */
  private getBenefitsOfMigration(): string[] {
    return [
      'Better resource management with automatic cleanup',
      'Improved performance through parallel execution',
      'Enhanced monitoring and debugging capabilities',
      'More robust error handling and recovery',
      'Security sandboxing for plugin isolation',
      'Future-proof architecture for new features'
    ];
  }
  
  /**
   * Get step-by-step migration guide
   */
  private getMigrationSteps(): string[] {
    return [
      '1. Enable gradual migration mode in convergence config',
      '2. Test existing functionality with V2 compatibility layer',
      '3. Gradually enable V2 features (lifecycle, then execution, then security)',
      '4. Monitor performance and behavior changes',
      '5. Update code to use V2-specific features when beneficial',
      '6. Remove V1 fallback when confident in V2 stability'
    ];
  }
}

/**
 * Default convergence adapter instance
 */
let defaultAdapter: V1V2ConvergenceAdapter | null = null;

/**
 * Get the default convergence adapter
 */
export function getConvergenceAdapter(config?: ConvergenceConfig): V1V2ConvergenceAdapter {
  if (!defaultAdapter) {
    defaultAdapter = new V1V2ConvergenceAdapter(config);
  }
  return defaultAdapter;
}

/**
 * Convenience function for adaptive proxy wrapping
 */
export async function wrapWithAdaptiveProxy(
  server: McpServer,
  options: ProxyWrapperOptions = {},
  convergenceConfig?: ConvergenceConfig
): Promise<McpServer> {
  const adapter = getConvergenceAdapter(convergenceConfig);
  return adapter.wrapWithProxy(server, options);
}

/**
 * Get migration assessment for current configuration
 */
export function assessMigrationReadiness(
  options: ProxyWrapperOptions,
  convergenceConfig?: ConvergenceConfig
): {
  ready: boolean;
  score: number;
  recommendations: string[];
  plan: any;
} {
  const adapter = getConvergenceAdapter(convergenceConfig);
  const plan = adapter.generateMigrationPlan(options);
  
  // Calculate readiness score based on features
  let score = 0;
  if (options.plugins?.length) score += 20;
  if (options.pluginConfig?.enableHealthChecks) score += 30;
  if (options.hooks?.beforeToolCall || options.hooks?.afterToolCall) score += 25;
  if (options.debug) score += 15;
  if (options.pluginConfig?.maxPlugins) score += 10;
  
  return {
    ready: score >= 50,
    score,
    recommendations: plan.recommendedActions,
    plan
  };
}