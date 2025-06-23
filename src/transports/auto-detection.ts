/**
 * @file Transport Auto-Detection System
 * @version 2.0.0
 * @status STABLE - Intelligent transport detection and selection
 * 
 * Provides automatic detection and selection of the best transport adapter
 * based on configuration, server capabilities, and network conditions.
 * Supports heuristic-based detection and fallback strategies.
 */

import { URL } from 'url';
import { createLogger } from '../utils/logger.js';
import { 
  TransportConfig, 
  TransportType, 
  StdioTransportConfig,
  WebSocketTransportConfig,
  HttpTransportConfig,
  SSETransportConfig,
  IConnectionAdapter,
  BaseTransportConfig
} from '../interfaces/connection.js';
import { TransportFactory } from './transport-factory.js';

/**
 * Detection result with confidence score
 */
export interface DetectionResult {
  /** Detected transport type */
  transport: TransportType;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Generated configuration */
  config: TransportConfig;
  
  /** Reason for selection */
  reason: string;
  
  /** Alternative options */
  alternatives: Array<{
    transport: TransportType;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Auto-detection options
 */
export interface AutoDetectionOptions {
  /** Preferred transport types in order */
  preferredTransports?: TransportType[];
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Whether to test connections during detection */
  testConnections?: boolean;
  
  /** Timeout for connection tests */
  testTimeout?: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Custom headers for HTTP-based detection */
  headers?: Record<string, string>;
  
  /** Fallback strategy when detection fails */
  fallbackStrategy?: 'first-available' | 'most-reliable' | 'fastest';
}

/**
 * Detection patterns for different transport types
 */
const DETECTION_PATTERNS = {
  stdio: {
    indicators: [
      { pattern: /^[a-zA-Z0-9/_-]+$/, weight: 0.8 }, // Executable path pattern
      { pattern: /\.(exe|bat|sh|py|js|ts)$/, weight: 0.9 }, // Executable extensions
      { pattern: /^(node|python|java|go)\s/, weight: 0.9 } // Runtime prefixes
    ],
    keywords: ['exec', 'command', 'binary', 'executable', 'process'],
    extensions: ['.exe', '.bat', '.sh', '.py', '.js', '.ts', '.jar']
  },
  
  websocket: {
    protocols: ['ws:', 'wss:'],
    indicators: [
      { pattern: /^wss?:\/\//, weight: 1.0 }, // WebSocket URL
      { pattern: /\/ws\b/, weight: 0.7 }, // WebSocket path
      { pattern: /\/websocket\b/, weight: 0.8 } // WebSocket path
    ],
    keywords: ['websocket', 'ws', 'socket', 'realtime'],
    ports: [8080, 3000, 4000, 8000]
  },
  
  http: {
    protocols: ['http:', 'https:'],
    indicators: [
      { pattern: /^https?:\/\//, weight: 1.0 }, // HTTP URL
      { pattern: /\/api\b/, weight: 0.6 }, // API path
      { pattern: /\/rpc\b/, weight: 0.7 }, // RPC path
      { pattern: /\/jsonrpc\b/, weight: 0.8 } // JSON-RPC path
    ],
    keywords: ['api', 'http', 'rest', 'rpc', 'json'],
    ports: [80, 443, 8080, 3000, 4000]
  },
  
  sse: {
    protocols: ['http:', 'https:'],
    indicators: [
      { pattern: /\/events?\b/, weight: 0.9 }, // Events path
      { pattern: /\/stream\b/, weight: 0.8 }, // Stream path
      { pattern: /\/sse\b/, weight: 1.0 } // SSE path
    ],
    keywords: ['events', 'stream', 'sse', 'server-sent'],
    ports: [80, 443, 8080, 3000]
  }
};

/**
 * Transport auto-detection service
 */
export class TransportAutoDetection {
  private logger = createLogger({ level: 'info', prefix: 'TRANSPORT-DETECTION' });
  
  constructor(
    private factory: TransportFactory,
    private options: AutoDetectionOptions = {}
  ) {
    this.logger = createLogger({
      level: this.options.debug ? 'debug' : 'info',
      prefix: 'TRANSPORT-DETECTION'
    });
  }
  
  /**
   * Auto-detect the best transport for a given input
   */
  async detectTransport(
    input: string | Partial<TransportConfig>,
    baseConfig: Partial<BaseTransportConfig> = {}
  ): Promise<DetectionResult> {
    this.logger.info('Starting transport auto-detection', {
      input: typeof input === 'string' ? input : input.transport,
      baseConfig: Object.keys(baseConfig)
    });
    
    try {
      // Parse input into standardized format
      const candidates = this.generateCandidates(input, baseConfig);
      
      // Score candidates
      const scoredCandidates = await this.scoreCandidates(candidates);
      
      // Select best candidate
      const bestCandidate = this.selectBestCandidate(scoredCandidates);
      
      this.logger.info('Transport detection completed', {
        selectedTransport: bestCandidate.transport,
        confidence: bestCandidate.confidence,
        reason: bestCandidate.reason
      });
      
      return bestCandidate;
      
    } catch (error) {
      this.logger.error('Transport detection failed:', error);
      throw new Error(`Transport auto-detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Detect transport from URL string
   */
  async detectFromUrl(url: string, baseConfig: Partial<BaseTransportConfig> = {}): Promise<DetectionResult> {
    this.logger.debug('Detecting transport from URL', { url });
    
    try {
      const parsedUrl = new URL(url);
      
      // Determine transport based on protocol and path
      if (parsedUrl.protocol === 'ws:' || parsedUrl.protocol === 'wss:') {
        return this.createDetectionResult('websocket', 1.0, {
          transport: 'websocket',
          url,
          ...baseConfig
        } as WebSocketTransportConfig, 'WebSocket protocol detected');
      }
      
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        // Check path patterns for specific transports
        const path = parsedUrl.pathname.toLowerCase();
        
        if (path.includes('sse') || path.includes('events') || path.includes('stream')) {
          return this.createDetectionResult('sse', 0.9, {
            transport: 'sse',
            url,
            ...baseConfig
          } as SSETransportConfig, 'SSE path pattern detected');
        }
        
        if (path.includes('ws') || path.includes('websocket')) {
          return this.createDetectionResult('websocket', 0.8, {
            transport: 'websocket',
            url: url.replace(/^http/, 'ws'),
            ...baseConfig
          } as WebSocketTransportConfig, 'WebSocket path pattern detected');
        }
        
        // Default to HTTP
        return this.createDetectionResult('http', 0.7, {
          transport: 'http',
          url,
          ...baseConfig
        } as HttpTransportConfig, 'HTTP protocol detected');
      }
      
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
      
    } catch (error) {
      if (error instanceof TypeError) {
        // Not a valid URL, might be a command
        return this.detectFromCommand(url, baseConfig);
      }
      throw error;
    }
  }
  
  /**
   * Detect transport from command string
   */
  async detectFromCommand(command: string, baseConfig: Partial<BaseTransportConfig> = {}): Promise<DetectionResult> {
    this.logger.debug('Detecting transport from command', { command });
    
    const patterns = DETECTION_PATTERNS.stdio;
    let confidence = 0.5; // Base confidence for command-like input
    
    // Check for executable indicators
    for (const indicator of patterns.indicators) {
      if (indicator.pattern.test(command)) {
        confidence = Math.max(confidence, indicator.weight);
      }
    }
    
    // Check for keywords
    const lowerCommand = command.toLowerCase();
    for (const keyword of patterns.keywords) {
      if (lowerCommand.includes(keyword)) {
        confidence += 0.1;
      }
    }
    
    // Check for file extensions
    for (const ext of patterns.extensions) {
      if (command.endsWith(ext)) {
        confidence += 0.2;
        break;
      }
    }
    
    // Parse command into array
    const commandParts = command.trim().split(/\s+/);
    
    return this.createDetectionResult('stdio', Math.min(confidence, 1.0), {
      transport: 'stdio',
      command: commandParts,
      ...baseConfig
    } as StdioTransportConfig, 'Command pattern detected');
  }
  
  /**
   * Test if a transport configuration actually works
   */
  async testTransport(config: TransportConfig): Promise<{ success: boolean; error?: Error; latency?: number }> {
    if (!this.options.testConnections) {
      return { success: true };
    }
    
    this.logger.debug('Testing transport configuration', {
      transport: config.transport
    });
    
    const startTime = Date.now();
    
    try {
      // Create connection with test timeout
      const connection = await this.factory.createConnection(config, {
        timeout: this.options.testTimeout || 5000,
        forceNew: true
      });
      
      const latency = Date.now() - startTime;
      
      // Close connection immediately
      await connection.close();
      
      this.logger.debug('Transport test successful', {
        transport: config.transport,
        latency
      });
      
      return { success: true, latency };
      
    } catch (error) {
      this.logger.debug('Transport test failed', {
        transport: config.transport,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error)) 
      };
    }
  }
  
  /**
   * Generate candidate configurations from input
   */
  private generateCandidates(
    input: string | Partial<TransportConfig>,
    baseConfig: Partial<BaseTransportConfig>
  ): TransportConfig[] {
    if (typeof input === 'string') {
      // Try to parse as URL first, then as command
      try {
        const url = new URL(input);
        return this.generateUrlCandidates(url, baseConfig);
      } catch {
        return this.generateCommandCandidates(input, baseConfig);
      }
    } else {
      // Already a partial config
      if (input.transport) {
        return [{ ...baseConfig, ...input } as TransportConfig];
      } else {
        // Generate candidates for all supported transports
        return this.generateAllCandidates(input, baseConfig);
      }
    }
  }
  
  /**
   * Generate candidates from URL
   */
  private generateUrlCandidates(url: URL, baseConfig: Partial<BaseTransportConfig>): TransportConfig[] {
    const candidates: TransportConfig[] = [];
    
    if (url.protocol === 'ws:' || url.protocol === 'wss:') {
      candidates.push({
        transport: 'websocket',
        url: url.toString(),
        ...baseConfig
      } as WebSocketTransportConfig);
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      // HTTP
      candidates.push({
        transport: 'http',
        url: url.toString(),
        ...baseConfig
      } as HttpTransportConfig);
      
      // SSE (if path suggests it)
      const path = url.pathname.toLowerCase();
      if (path.includes('sse') || path.includes('events') || path.includes('stream')) {
        candidates.push({
          transport: 'sse',
          url: url.toString(),
          ...baseConfig
        } as SSETransportConfig);
      }
      
      // WebSocket (try converting)
      const wsUrl = url.toString().replace(/^http/, 'ws');
      candidates.push({
        transport: 'websocket',
        url: wsUrl,
        ...baseConfig
      } as WebSocketTransportConfig);
    }
    
    return candidates;
  }
  
  /**
   * Generate candidates from command
   */
  private generateCommandCandidates(command: string, baseConfig: Partial<BaseTransportConfig>): TransportConfig[] {
    const commandParts = command.trim().split(/\s+/);
    
    return [{
      transport: 'stdio',
      command: commandParts,
      ...baseConfig
    } as StdioTransportConfig];
  }
  
  /**
   * Generate candidates for all transport types
   */
  private generateAllCandidates(
    partialConfig: Partial<TransportConfig>,
    baseConfig: Partial<BaseTransportConfig>
  ): TransportConfig[] {
    const candidates: TransportConfig[] = [];
    const supportedTransports = this.factory.getSupportedTransports();
    
    for (const transport of supportedTransports) {
      try {
        const config = {
          transport,
          ...baseConfig,
          ...partialConfig
        } as TransportConfig;
        
        candidates.push(config);
      } catch (error) {
        this.logger.debug(`Failed to generate candidate for ${transport}:`, error);
      }
    }
    
    return candidates;
  }
  
  /**
   * Score all candidates
   */
  private async scoreCandidates(candidates: TransportConfig[]): Promise<Array<{
    config: TransportConfig;
    confidence: number;
    reason: string;
    testResult?: { success: boolean; error?: Error; latency?: number };
  }>> {
    const scored = [];
    
    for (const config of candidates) {
      try {
        let confidence = 0.5; // Base confidence
        let reason = `${config.transport} transport`;
        
        // Score based on pattern matching
        confidence = this.scoreByPatterns(config);
        
        // Adjust based on preferences
        const preferredIndex = this.options.preferredTransports?.indexOf(config.transport) ?? -1;
        if (preferredIndex >= 0) {
          confidence += 0.2 * (1 - preferredIndex / this.options.preferredTransports!.length);
          reason += ' (preferred)';
        }
        
        // Test connection if enabled
        let testResult;
        if (this.options.testConnections) {
          testResult = await this.testTransport(config);
          if (testResult.success) {
            confidence += 0.3;
            reason += ' (tested)';
          } else {
            confidence *= 0.3; // Significant penalty for failed test
            reason += ' (test failed)';
          }
        }
        
        scored.push({ config, confidence: Math.min(confidence, 1.0), reason, testResult });
        
      } catch (error) {
        this.logger.debug(`Failed to score candidate ${config.transport}:`, error);
      }
    }
    
    return scored.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Score configuration based on pattern matching
   */
  private scoreByPatterns(config: TransportConfig): number {
    const patterns = DETECTION_PATTERNS[config.transport as keyof typeof DETECTION_PATTERNS];
    if (!patterns) return 0.5;
    
    let score = 0.5;
    
    // URL-based scoring
    if ('url' in config && config.url) {
      try {
        const url = new URL(config.url);
        
        // Protocol match
        if ('protocols' in patterns && patterns.protocols?.includes(url.protocol)) {
          score += 0.4;
        }
        
        // Pattern match
        const fullUrl = config.url.toLowerCase();
        for (const indicator of patterns.indicators || []) {
          if (indicator.pattern.test(fullUrl)) {
            score += indicator.weight * 0.3;
          }
        }
        
        // Port match
        const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
        if ('ports' in patterns && patterns.ports?.includes(port)) {
          score += 0.1;
        }
        
      } catch {
        // Invalid URL
        score *= 0.5;
      }
    }
    
    // Command-based scoring
    if ('command' in config && config.command) {
      const commandStr = Array.isArray(config.command) 
        ? config.command.join(' ') 
        : config.command;
      
      for (const indicator of patterns.indicators || []) {
        if (indicator.pattern.test(commandStr)) {
          score += indicator.weight * 0.3;
        }
      }
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Select the best candidate
   */
  private selectBestCandidate(candidates: Array<{
    config: TransportConfig;
    confidence: number;
    reason: string;
    testResult?: { success: boolean; error?: Error; latency?: number };
  }>): DetectionResult {
    if (candidates.length === 0) {
      throw new Error('No viable transport candidates found');
    }
    
    // Filter by minimum confidence
    const minConfidence = this.options.minConfidence || 0.3;
    const viableCandidates = candidates.filter(c => c.confidence >= minConfidence);
    
    if (viableCandidates.length === 0) {
      // Fallback strategy
      const fallbackCandidate = this.applyFallbackStrategy(candidates);
      if (fallbackCandidate) {
        return this.createDetectionResultFromCandidate(fallbackCandidate, candidates);
      }
      
      throw new Error(`No candidates meet minimum confidence threshold of ${minConfidence}`);
    }
    
    // Use the highest confidence candidate
    const best = viableCandidates[0];
    return this.createDetectionResultFromCandidate(best, candidates);
  }
  
  /**
   * Apply fallback strategy when no candidates meet minimum confidence
   */
  private applyFallbackStrategy(candidates: Array<{
    config: TransportConfig;
    confidence: number;
    reason: string;
    testResult?: { success: boolean; error?: Error; latency?: number };
  }>) {
    switch (this.options.fallbackStrategy) {
      case 'first-available':
        return candidates.find(c => !c.testResult || c.testResult.success);
      
      case 'most-reliable':
        // Prefer STDIO > HTTP > WebSocket > SSE
        const reliabilityOrder: TransportType[] = ['stdio', 'http', 'websocket', 'sse'];
        for (const transport of reliabilityOrder) {
          const candidate = candidates.find(c => 
            c.config.transport === transport && (!c.testResult || c.testResult.success)
          );
          if (candidate) return candidate;
        }
        break;
      
      case 'fastest':
        return candidates
          .filter(c => !c.testResult || c.testResult.success)
          .sort((a, b) => (a.testResult?.latency || Infinity) - (b.testResult?.latency || Infinity))[0];
      
      default:
        return candidates[0];
    }
    
    return candidates[0];
  }
  
  /**
   * Create detection result from candidate
   */
  private createDetectionResultFromCandidate(
    best: {
      config: TransportConfig;
      confidence: number;
      reason: string;
      testResult?: { success: boolean; error?: Error; latency?: number };
    },
    allCandidates: Array<{
      config: TransportConfig;
      confidence: number;
      reason: string;
      testResult?: { success: boolean; error?: Error; latency?: number };
    }>
  ): DetectionResult {
    const alternatives = allCandidates
      .filter(c => c !== best)
      .slice(0, 3) // Top 3 alternatives
      .map(c => ({
        transport: c.config.transport,
        confidence: c.confidence,
        reason: c.reason
      }));
    
    return {
      transport: best.config.transport,
      confidence: best.confidence,
      config: best.config,
      reason: best.reason,
      alternatives
    };
  }
  
  /**
   * Create a detection result
   */
  private createDetectionResult(
    transport: TransportType,
    confidence: number,
    config: TransportConfig,
    reason: string
  ): DetectionResult {
    return {
      transport,
      confidence,
      config,
      reason,
      alternatives: []
    };
  }
}

/**
 * Convenience function to auto-detect transport
 */
export async function autoDetectTransport(
  input: string | Partial<TransportConfig>,
  factory: TransportFactory,
  options: AutoDetectionOptions = {}
): Promise<DetectionResult> {
  const detector = new TransportAutoDetection(factory, options);
  return detector.detectTransport(input);
}

/**
 * Quick detection from URL
 */
export async function detectFromUrl(
  url: string,
  factory: TransportFactory,
  options: AutoDetectionOptions = {}
): Promise<DetectionResult> {
  const detector = new TransportAutoDetection(factory, options);
  return detector.detectFromUrl(url);
}

/**
 * Quick detection from command
 */
export async function detectFromCommand(
  command: string,
  factory: TransportFactory,
  options: AutoDetectionOptions = {}
): Promise<DetectionResult> {
  const detector = new TransportAutoDetection(factory, options);
  return detector.detectFromCommand(command);
}