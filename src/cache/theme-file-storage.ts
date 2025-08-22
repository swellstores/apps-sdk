// ABOUTME: Theme file storage abstraction layer for efficient KV operations
// Handles batching, size validation, and environment-specific optimizations

import bluebird from 'bluebird';
const { Promise } = bluebird;

import type { SwellThemeConfig } from '../../types/swell';
import type { CFThemeEnv } from '../../types/cloudflare';
import type { ClientKV, KVFlavor } from './kv-variety';
import { createClientKV } from './kv-variety';
import { logger, createTraceId } from '../utils/logger';

/**
 * Main interface for theme file storage operations
 */
export interface ThemeFileStorageInterface {
  /**
   * Load files for given configs, intelligently batching to avoid 413 errors
   * Returns new configs with file_data populated
   */
  getFiles(configs: SwellThemeConfig[]): Promise<SwellThemeConfig[]>;

  /**
   * Store files, checking existence first to avoid redundant writes
   * Validates file sizes and returns detailed results
   */
  putFiles(configs: SwellThemeConfig[]): Promise<PutFilesResult>;
}

/**
 * Result of a putFiles operation
 */
export interface PutFilesResult {
  /** Number of files successfully written to storage */
  written: number;
  /** Number of files skipped due to size violations */
  skipped: number;
  /** Number of files skipped because they already exist */
  skippedExisting: number;
  /** Detailed warnings about file size issues */
  warnings: FileWarning[];
}

/**
 * Warning about a file that triggered size thresholds
 */
export interface FileWarning {
  /** Hash identifier of the file */
  hash: string;
  /** Path of the file for logging */
  filePath: string;
  /** Size of the file in bytes */
  size: number;
  /** Reason for the warning */
  reason: 'warning_1mb' | 'rejected_5mb' | 'exceeded_25mb';
  /** Action taken for this file */
  action: 'stored' | 'rejected';
}

/**
 * Configuration batch for GET operations
 */
interface ConfigBatch {
  configs: SwellThemeConfig[];
  keys: string[];
  estimatedSize: number;
}

/**
 * Theme file storage implementation
 * Manages efficient batch operations for theme files in KV storage
 */
export class ThemeFileStorage implements ThemeFileStorageInterface {
  private kv: ClientKV;
  private maxConcurrency: number;
  private maxBatchSize: number = 20 * 1024 * 1024; // 20MB safety margin

  constructor(env?: CFThemeEnv, flavor: KVFlavor = 'cf') {
    this.kv = createClientKV(env, flavor);

    // Set concurrency based on environment
    // Miniflare can handle more concurrent operations in local development
    this.maxConcurrency = flavor === 'miniflare' ? 50 : 6;
  }

  /**
   * Build a KV storage key from a file hash
   */
  private buildKey(hash: string): string {
    return `file_data:${hash}`;
  }

  /**
   * Extract hash from a KV storage key
   */
  private extractHashFromKey(key: string): string {
    return key.replace('file_data:', '');
  }

  /**
   * Plan GET batches based on file sizes to avoid 413 errors
   * Uses round-robin distribution for even batch sizes
   */
  private planGetBatches(configs: SwellThemeConfig[]): ConfigBatch[] {
    if (configs.length === 0) {
      return [];
    }

    // Sort by size (largest first) for better distribution
    const sorted = [...configs].sort((a, b) => {
      const sizeA = a.file?.length || 0;
      const sizeB = b.file?.length || 0;
      return sizeB - sizeA;
    });

    // Calculate minimum batches needed
    const totalSize = sorted.reduce((sum, config) => {
      return sum + (config.file?.length || 0);
    }, 0);

    // Determine batch count based on constraints
    const sizeBatches = Math.ceil(totalSize / this.maxBatchSize);
    const keyBatches = Math.ceil(sorted.length / 100); // CF limit
    const targetBatches = Math.max(sizeBatches, keyBatches);

    // Initialize batches
    const batches: ConfigBatch[] = Array.from(
      { length: targetBatches },
      () => ({
        configs: [],
        keys: [],
        estimatedSize: 0,
      }),
    );

    // Round-robin distribution for even batch sizes
    sorted.forEach((config, index) => {
      const batchIndex = index % targetBatches;
      const batch = batches[batchIndex];

      batch.configs.push(config);
      batch.keys.push(this.buildKey(config.hash));
      batch.estimatedSize += config.file?.length || 0;
    });

    // Filter out empty batches (shouldn't happen, but be safe)
    return batches.filter((batch) => batch.configs.length > 0);
  }

  /**
   * Load a single batch from KV storage
   */
  private async loadBatch(
    batch: ConfigBatch,
  ): Promise<Map<string, string | null>> {
    // Use underlying KV batch operation
    return this.kv.get(batch.keys);
  }

  /**
   * Merge batch results with original configs
   */
  private mergeResults(
    configs: SwellThemeConfig[],
    batchResults: Map<string, string | null>[],
  ): SwellThemeConfig[] {
    // Combine all batch results into a single map
    const allData = new Map<string, string | null>();
    for (const batchResult of batchResults) {
      for (const [key, value] of batchResult.entries()) {
        allData.set(key, value);
      }
    }

    // Return new config objects with file_data populated
    return configs.map((config) => {
      const key = this.buildKey(config.hash);
      const fileData = allData.get(key);

      if (fileData) {
        // Return new config with file_data populated
        return {
          ...config,
          file_data: fileData,
        };
      }

      // Return config without file_data if not found
      return config;
    });
  }

  async getFiles(configs: SwellThemeConfig[]): Promise<SwellThemeConfig[]> {
    if (configs.length === 0) {
      return [];
    }

    const trace = createTraceId();

    // Use intelligent batch planning to avoid 413 errors
    const batches = this.planGetBatches(configs);

    const totalSize = batches.reduce((sum, b) => sum + b.estimatedSize, 0);
    const maxBatchSize = Math.max(...batches.map((b) => b.estimatedSize));

    logger.debug('[ThemeFileStorage] Loading files start', {
      totalConfigs: configs.length,
      batchCount: batches.length,
      maxBatchSize,
      totalSize,
      trace,
    });

    // Execute batches with appropriate concurrency
    const results = await Promise.map(
      batches,
      (batch) => this.loadBatch(batch),
      { concurrency: Math.min(this.maxConcurrency, batches.length) },
    );

    // Merge results and return new configs with file_data
    const mergedConfigs = this.mergeResults(configs, results);

    const loadedCount = mergedConfigs.filter((c) => c.file_data).length;

    logger.debug('[ThemeFileStorage] Loading files end', {
      requested: configs.length,
      loaded: loadedCount,
      missing: configs.length - loadedCount,
      batches: batches.length,
      trace,
    });

    return mergedConfigs;
  }

  /**
   * Validate file sizes and categorize by threshold
   */
  private validateFiles(configs: SwellThemeConfig[]): {
    valid: SwellThemeConfig[];
    warnings: FileWarning[];
  } {
    const valid: SwellThemeConfig[] = [];
    const warnings: FileWarning[] = [];

    for (const config of configs) {
      // Skip configs without file_data
      if (!config.file_data) {
        continue;
      }

      const size = config.file?.length || 0;

      if (size >= 25 * 1024 * 1024) {
        // 25MB+ - never attempt
        warnings.push({
          hash: config.hash,
          filePath: config.file_path,
          size,
          reason: 'exceeded_25mb',
          action: 'rejected',
        });
      } else if (size >= 5 * 1024 * 1024) {
        // 5MB+ - reject from cache
        warnings.push({
          hash: config.hash,
          filePath: config.file_path,
          size,
          reason: 'rejected_5mb',
          action: 'rejected',
        });
      } else {
        // Under 5MB - can be stored
        if (size >= 1024 * 1024) {
          // 1MB+ - warning but still store
          warnings.push({
            hash: config.hash,
            filePath: config.file_path,
            size,
            reason: 'warning_1mb',
            action: 'stored',
          });
        }
        valid.push(config);
      }
    }

    return { valid, warnings };
  }

  /**
   * Check which files already exist in KV storage
   * Uses batch planning to avoid 413 errors when checking existence
   */
  private async checkExistence(
    configs: SwellThemeConfig[],
  ): Promise<Set<string>> {
    if (configs.length === 0) {
      return new Set();
    }

    const existing = new Set<string>();

    // Use the same batch planning to avoid 413 errors
    // KV GET returns full values, so we need size-aware batching
    const batches = this.planGetBatches(configs);

    // Check existence using planned batches
    const results = await Promise.map(
      batches,
      (batch) => this.kv.get(batch.keys),
      { concurrency: this.maxConcurrency },
    );

    // Mark existing files
    for (const batchResult of results) {
      for (const [key, value] of batchResult.entries()) {
        if (value !== null) {
          const hash = this.extractHashFromKey(key);
          existing.add(hash);
        }
      }
    }

    return existing;
  }

  async putFiles(configs: SwellThemeConfig[]): Promise<PutFilesResult> {
    const result: PutFilesResult = {
      written: 0,
      skipped: 0,
      skippedExisting: 0,
      warnings: [],
    };

    if (configs.length === 0) {
      return result;
    }

    const trace = createTraceId();

    logger.debug('[ThemeFileStorage] Put files start', {
      totalConfigs: configs.length,
      trace,
    });

    // Validate files and filter by size
    const { valid, warnings } = this.validateFiles(configs);
    result.warnings = warnings;

    // Log validation warnings
    if (warnings.length > 0) {
      const rejectedCount = warnings.filter(
        (w) => w.action === 'rejected',
      ).length;
      const warnedCount = warnings.filter((w) => w.action === 'stored').length;

      logger.warn('[ThemeFileStorage] File size validation issues', {
        totalWarnings: warnings.length,
        rejected: rejectedCount,
        warned: warnedCount,
        trace,
      });

      // Log individual warnings for rejected files
      warnings
        .filter((w) => w.action === 'rejected')
        .forEach((w) => {
          logger.error('[ThemeFileStorage] File rejected due to size', {
            filePath: w.filePath,
            size: w.size,
            reason: w.reason,
            trace,
          });
        });
    }

    // Count rejected files as skipped
    const rejected = warnings.filter((w) => w.action === 'rejected').length;
    result.skipped =
      rejected + (configs.length - configs.filter((c) => c.file_data).length);

    // Check which valid files already exist
    logger.debug('[ThemeFileStorage] Checking existence', {
      validFiles: valid.length,
      trace,
    });

    const existing = await this.checkExistence(valid);
    result.skippedExisting = existing.size;

    // Filter out existing files
    const toWrite = valid.filter((config) => !existing.has(config.hash));

    if (toWrite.length > 0) {
      logger.debug('[ThemeFileStorage] Writing new files', {
        toWrite: toWrite.length,
        skippedExisting: existing.size,
        trace,
      });

      // Write only new files with appropriate concurrency
      await Promise.map(
        toWrite,
        async (config) => {
          const key = this.buildKey(config.hash);
          const metadata = config.file?.content_type
            ? { content_type: config.file.content_type }
            : undefined;

          await this.kv.put(key, config.file_data, metadata);
          result.written++;
        },
        { concurrency: this.maxConcurrency },
      );
    }

    logger.info('[ThemeFileStorage] Put files complete', {
      written: result.written,
      skipped: result.skipped,
      skippedExisting: result.skippedExisting,
      warnings: result.warnings.length,
      trace,
    });

    return result;
  }
}
