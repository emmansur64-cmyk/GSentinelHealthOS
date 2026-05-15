import { Injectable, Logger } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import { IncidentPayload } from '../common/types/brain.types';
import { DlModelLoader } from './model.loader';
import { SequenceBuilderService } from './sequence-builder';

export interface DlPredictOutput {
  available: boolean;
  anomalyScore: number;
  threshold: number;
  isAnomaly: boolean;
  sequenceUsed: number[][];
  sourceEventIds: string[];
}

@Injectable()
export class AnomalyPredictorService {
  private readonly logger = new Logger(AnomalyPredictorService.name);

  constructor(
    private readonly loader: DlModelLoader,
    private readonly sequenceBuilder: SequenceBuilderService,
  ) {}

  async predictAnomaly(input: IncidentPayload): Promise<DlPredictOutput> {
    const session = this.loader.getSession();
    const threshold = this.loader.getAnomalyThreshold();
    const sequenceLength = this.loader.getSequenceLength();
    const featureColumns = this.loader.getFeatureColumns();

    const built = await this.sequenceBuilder.buildSequence(input, sequenceLength, featureColumns);
    const normalizedSequence = this.normalizeSequence(built.sequence);

    if (!session) {
      return {
        available: false,
        anomalyScore: 0,
        threshold,
        isAnomaly: false,
        sequenceUsed: built.sequence,
        sourceEventIds: built.sourceEventIds,
      };
    }

    try {
      const flat = Float32Array.from(normalizedSequence.flat());
      const featureDim = normalizedSequence[0]?.length ?? 1;
      const tensor = new ort.Tensor('float32', flat, [1, normalizedSequence.length, featureDim]);
      const inputName = session.inputNames[0] ?? 'sequence_input';
      const outputs = await session.run({ [inputName]: tensor });
      const outputName = session.outputNames[1] ?? session.outputNames[0];
      const anomalyScore = this.readFirstScalar(outputs[outputName]);

      return {
        available: true,
        anomalyScore,
        threshold,
        isAnomaly: anomalyScore > threshold,
        sequenceUsed: built.sequence,
        sourceEventIds: built.sourceEventIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[DL] anomaly inference failed: ${message}`);
      return {
        available: false,
        anomalyScore: 0,
        threshold,
        isAnomaly: false,
        sequenceUsed: built.sequence,
        sourceEventIds: built.sourceEventIds,
      };
    }
  }

  async reloadModel(): Promise<boolean> {
    return this.loader.reload();
  }

  getThreshold(): number {
    return this.loader.getAnomalyThreshold();
  }

  private normalizeSequence(sequence: number[][]): number[][] {
    const means = this.loader.getFeatureMeans();
    const stds = this.loader.getFeatureStds();
    if (!means.length || !stds.length) {
      return sequence;
    }

    return sequence.map((row) =>
      row.map((value, index) => {
        const mean = means[index] ?? 0;
        const std = stds[index] && Number.isFinite(stds[index]) ? stds[index] : 1;
        return (value - mean) / (std === 0 ? 1 : std);
      }),
    );
  }

  private readFirstScalar(output: unknown): number {
    if (!output || typeof output !== 'object') return 0;
    const tensorLike = output as { data?: unknown };
    if (!ArrayBuffer.isView(tensorLike.data)) return 0;
    const values = Array.from(tensorLike.data as unknown as ArrayLike<unknown>, (value) => Number(value));
    const first = values[0] ?? 0;
    return Number.isFinite(first) ? first : 0;
  }
}