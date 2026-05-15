import { Injectable, Logger } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import { IncidentPayload } from '../common/types/brain.types';
import { DlModelLoader } from './model.loader';
import { DlSequenceBuilderService } from './sequence-builder.service';

export interface DlPredictOutput {
  available: boolean;
  anomalyScore: number;
  patternClass: number | null;
  patternProbabilities: number[];
  sequenceUsed: number[][];
  sourceIncidentIds: string[];
  threshold: number;
}

@Injectable()
export class DlPredictorService {
  private readonly logger = new Logger(DlPredictorService.name);

  constructor(
    private readonly loader: DlModelLoader,
    private readonly sequenceBuilder: DlSequenceBuilderService,
  ) {}

  async predictAnomaly(input: IncidentPayload): Promise<DlPredictOutput> {
    const session = this.loader.getSession();
    const threshold = this.loader.getAnomalyThreshold();
    const sequenceLength = this.loader.getSequenceLength();
    const featureColumns = this.loader.getFeatureColumns();

    const built = await this.sequenceBuilder.buildSequence(input, sequenceLength, featureColumns);
    const sequenceUsed = built.sequence;

    if (!session) {
      return {
        available: false,
        anomalyScore: 0,
        patternClass: null,
        patternProbabilities: [],
        sequenceUsed,
        sourceIncidentIds: built.sourceIncidentIds,
        threshold,
      };
    }

    try {
      const flat = Float32Array.from(sequenceUsed.flat());
      const featureDim = sequenceUsed[0]?.length ?? 1;
      const tensor = new ort.Tensor('float32', flat, [1, sequenceUsed.length, featureDim]);
      const inputName = session.inputNames[0] ?? 'sequence_input';
      const outputs = await session.run({ [inputName]: tensor });

      const anomaly = this.read1D(outputs[session.outputNames[0]])[0] ?? 0;
      const probs = this.read1D(outputs[session.outputNames[1]]);
      const clsRaw = this.read1D(outputs[session.outputNames[2]])[0];
      const patternClass = Number.isFinite(clsRaw) ? Math.trunc(clsRaw) : null;

      return {
        available: true,
        anomalyScore: Number.isFinite(anomaly) ? anomaly : 0,
        patternClass,
        patternProbabilities: probs,
        sequenceUsed,
        sourceIncidentIds: built.sourceIncidentIds,
        threshold,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[DL] inference failed: ${msg}`);
      return {
        available: false,
        anomalyScore: 0,
        patternClass: null,
        patternProbabilities: [],
        sequenceUsed,
        sourceIncidentIds: built.sourceIncidentIds,
        threshold,
      };
    }
  }

  async reloadModel(): Promise<boolean> {
    return this.loader.reload();
  }

  getThreshold(): number {
    return this.loader.getAnomalyThreshold();
  }

  private read1D(output: unknown): number[] {
    if (!output || typeof output !== 'object') return [];
    const tensorLike = output as { data?: unknown };
    if (ArrayBuffer.isView(tensorLike.data)) {
      return Array.from(tensorLike.data as unknown as ArrayLike<unknown>, (x) => Number(x));
    }
    return [];
  }
}
