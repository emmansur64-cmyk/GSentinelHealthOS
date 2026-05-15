import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ModelVersion {
  version: string;
  timestamp: string;
  test_accuracy: number;
  overfitting_score: number;
  feature_schema_version?: string;
  pipeline_version?: string;
  feature_names_hash?: string;
  encoder_hash?: string;
  action_encoder_hash?: string;
  status: 'STAGING' | 'PRODUCTION' | 'SUPERSEDED' | 'REJECTED';
  notes: string;
}

interface ModelRegistry {
  versions: ModelVersion[];
  current_production: string | null;
  staging: string | null;
  history: any[];
}

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);
  private readonly registryPath = join(process.cwd(), 'models', 'registry.json');
  private registry: ModelRegistry | null = null;
  private lastLoadTime = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds

  /**
   * Get model registry with caching
   */
  async getRegistry(): Promise<ModelRegistry> {
    const now = Date.now();
    if (!this.registry || (now - this.lastLoadTime) > this.CACHE_TTL) {
      await this.loadRegistry();
    }
    return this.registry!;
  }

  /**
   * Get information about a specific model version
   */
  async getModelInfo(version: string): Promise<ModelVersion | null> {
    const registry = await this.getRegistry();

    if (version === 'production') {
      if (!registry.current_production) return null;
      return registry.versions.find(v => v.version === registry.current_production) || null;
    }

    if (version === 'staging') {
      if (!registry.staging) return null;
      return registry.versions.find(v => v.version === registry.staging) || null;
    }

    return registry.versions.find(v => v.version === version) || null;
  }

  /**
   * Get all available versions
   */
  async getAllVersions(): Promise<ModelVersion[]> {
    const registry = await this.getRegistry();
    return registry.versions;
  }

  /**
   * Get production version info
   */
  async getProductionVersion(): Promise<ModelVersion | null> {
    const registry = await this.getRegistry();
    if (!registry.current_production) return null;
    return registry.versions.find(v => v.version === registry.current_production) || null;
  }

  /**
   * Check if a model version exists
   */
  async versionExists(version: string): Promise<boolean> {
    const modelInfo = await this.getModelInfo(version);
    return modelInfo !== null;
  }

  /**
   * Get model file path for a version
   */
  getModelFilePath(version: string): string {
    return join(process.cwd(), 'models', version, 'decision_model.onnx');
  }

  /**
   * Force reload registry from disk
   */
  async reloadRegistry(): Promise<void> {
    await this.loadRegistry();
  }

  private async loadRegistry(): Promise<void> {
    try {
      if (!existsSync(this.registryPath)) {
        this.logger.warn(`[Registry] Registry file not found: ${this.registryPath}`);
        this.registry = {
          versions: [],
          current_production: null,
          staging: null,
          history: [],
        };
        return;
      }

      const raw = readFileSync(this.registryPath, 'utf-8');
      this.registry = JSON.parse(raw);
      this.lastLoadTime = Date.now();

      if (this.registry) {
        this.logger.debug(`[Registry] Loaded ${this.registry.versions.length} model versions`);
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Registry] Failed to load registry: ${msg}`);
      throw error;
    }
  }
}