import { Injectable, Logger, Optional } from '@nestjs/common';
import { ActionService } from '../action-engine/action.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { extractErrorFingerprint } from '../common/utils/error-parser.util';
import {
  ActionEnvelope,
  BrainDecision,
  ErrorFingerprint,
  GatedExecutionResult,
  IncidentPayload,
  IncidentResult,
  CommandId,
  MlPredictionTrace,
} from '../common/types/brain.types';
import { EventProducer } from '../events/producer/event.producer';
import { GuardService } from '../guard/guard.service';
import { MemoryService } from '../memory/memory.service';
import { ExecutionService } from '../execution/execution.service';
import { SystemBrainService, EnrichedDiagnosis } from '../system-brain/system-brain.service';
import { LearningService } from '../learning/learning.service';
import { BrainRouter } from './brain.router';
import { BookingStrategy } from './strategies/booking.strategy';
import { ErrorStrategy } from './strategies/error.strategy';
import { ScheduleStrategy } from './strategies/schedule.strategy';
import { ModelService, MlPredictionFeatures } from '../ml/model.service';
import { PersistenceService } from '../persistence/persistence.service';
import { AnomalyPredictorService } from '../dl/anomaly-predictor.service';

@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);

  // Rate limiter: per-instance sliding window.
  // WARNING: in multi-instance deployments this limit is NOT global.
  // For global rate limiting a shared store (e.g. Redis) must be used.
  private readonly incidentTimestamps: number[] = [];
  private readonly rateLimitWindowMs = 1000;
  private readonly rateLimitMax = 5; // reduced from 10 — safer default for autonomous execution

  constructor(
    private readonly guardService: GuardService,
    private readonly aiService: AiService,
    private readonly actionService: ActionService,
    private readonly auditService: AuditService,
    private readonly memoryService: MemoryService,
    private readonly executionService: ExecutionService,
    private readonly eventProducer: EventProducer,
    private readonly router: BrainRouter,
    private readonly bookingStrategy: BookingStrategy,
    private readonly scheduleStrategy: ScheduleStrategy,
    private readonly errorStrategy: ErrorStrategy,
    private readonly modelService: ModelService,
    private readonly persistenceService: PersistenceService,
    @Optional() private readonly dlPredictorService?: AnomalyPredictorService,
    @Optional() private readonly systemBrainService?: SystemBrainService,
    @Optional() private readonly learningService?: LearningService,
  ) {
    this.logger.warn(
      '[RateLimit] Per-instance limit active (max=5/s). For multi-instance deployments configure a shared rate-limit store.',
    );
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;

    // Remove timestamps outside window
    while (this.incidentTimestamps.length > 0 && this.incidentTimestamps[0] < windowStart) {
      this.incidentTimestamps.shift();
    }

    // Check if limit exceeded
    if (this.incidentTimestamps.length >= this.rateLimitMax) {
      return false;
    }

    // Add current timestamp
    this.incidentTimestamps.push(now);
    return true;
  }

  async processIncident(input: IncidentPayload): Promise<IncidentResult> {
    let normalizedInput: IncidentPayload = input;
    let diagnosisCode: string | undefined;
    let decision: BrainDecision | undefined;
    let action: ActionEnvelope | undefined;
    let executionResult: GatedExecutionResult | null = null;
    let predictionTrace: MlPredictionTrace | undefined;
    let isDryRun = false;

    try {
      // --- Rate Limit Gate ---
      if (!this.checkRateLimit()) {
        this.logger.warn(`[RATE_LIMITED] ${input.id} — max 10 incidents/second exceeded`);
        this.auditSafe(input, undefined, undefined, undefined, 'BLOCKED', null, 'rate_limit_exceeded');
        return {
          status: 'BLOCKED',
          action: '',
          reason: 'rate_limit_exceeded',
          execution: null,
          meta: { incidentId: input.id, reason: 'System received >10 incidents/second' },
        };
      }

      // --- Phase 1: Input Guard ---
      const eventType = (input.metadata?.originalType as string) ?? '';
      const guardVerdict = this.guardService.validate(input, eventType);
      normalizedInput = guardVerdict.normalizedInput;

      if (!guardVerdict.allowed) {
        const reason = guardVerdict.reasons.join('; ');
        this.logger.log(`[BLOCKED/input] ${input.id} — ${reason}`);
        this.auditSafe(normalizedInput, diagnosisCode, decision, action, 'BLOCKED', null, reason);
        return {
          status: 'BLOCKED',
          action: '',
          reason,
          execution: null,
          meta: { reasons: guardVerdict.reasons, incidentId: input.id },
        };
      }

      isDryRun = normalizedInput.metadata?.['dryRun'] === true;

      // --- Phase 2: Fingerprint + Strategy ---
      const fingerprint = extractErrorFingerprint(normalizedInput);
      const enrichedDiagnosis = this.systemBrainService
        ? this.systemBrainService.process(fingerprint, normalizedInput)
        : this.buildDefaultEnrichedDiagnosis(fingerprint);

      diagnosisCode = enrichedDiagnosis.diagnosis.code;
      const route = this.router.route(enrichedDiagnosis.diagnosis);
      const enrichedInput = this.attachSystemBrainContext(normalizedInput, enrichedDiagnosis);

      decision = this.errorStrategy.decide(enrichedInput, enrichedDiagnosis.diagnosis);
      if (route === 'booking') {
        decision = this.bookingStrategy.decide(enrichedInput, enrichedDiagnosis.diagnosis);
      } else if (route === 'schedule') {
        decision = this.scheduleStrategy.decide(enrichedInput, enrichedDiagnosis.diagnosis);
      }

      decision = this.applySystemBrainDecisionSafety(decision, enrichedDiagnosis);

      // --- ML Hybrid Decision with Combined Scoring ---
      // Get learning insights to enrich ML features
      const insights = this.learningService?.getInsights() ?? {
        weakActions: [] as CommandId[],
        strongActions: [] as CommandId[],
        actionStats: {},
        qualityScore: 0,
        totalOutcomes: 0,
        windowMs: 0,
      };

      // Calculate learning boost (±0.10)
      const actionId = decision.action as CommandId;
      const learningBoost = insights.strongActions.includes(actionId)
        ? 0.10
        : insights.weakActions.includes(actionId)
          ? -0.10
          : 0.0;

      // Enrich ML features with learning signals
      const now = new Date(normalizedInput.timestamp);
      const hourOfDay = now.getHours();
      const dayOfWeek = now.getDay();
      
      const mlFeatures: MlPredictionFeatures = {
        hourOfDay,
        dayOfWeek,
        isStrongAction: insights.strongActions.includes(actionId) ? 1.0 : 0.0,
        isWeakAction: insights.weakActions.includes(actionId) ? 1.0 : 0.0,
        strategyConfidence: decision.confidence * 0.4, // Weighted rules input
        actionRiskScore: enrichedDiagnosis.actionRiskScore ?? 0.5,
      };

      // Get ML prediction with real confidence (NOT hardcoded 1.0)
      const mlResult = await this.modelService.predictDecision(
        normalizedInput,
        mlFeatures,
        decision.strategy,
        decision.action,
      );
      const mlThresholds = this.modelService.getDecisionThresholds();
      const rulesConfidence = decision.confidence;
      const mlConfidence = mlResult.confidence ?? 0.5;
      const mlAction = mlResult.action ? (mlResult.action as CommandId) : decision.action;

      // Combined score formula: (rules × 0.4) + (ml × 0.4) + (learning_boost + 0.10) × 0.2
      // Normalized learning boost to [0, 0.2] range: (learningBoost + 0.10) × 0.2
      const combinedScore =
        rulesConfidence * 0.4 +
        mlConfidence * 0.4 +
        (learningBoost + 0.10) * 0.2;

      // Select winner by highest individual confidence
      const rulesScore = rulesConfidence;
      const mlScore = mlConfidence;
      const winnerScore = Math.max(rulesScore, mlScore);
      const winnerSource = winnerScore === mlScore ? 'ml' : 'rules';
      const winnerAction = winnerScore === mlScore ? mlAction : decision.action;

      // Decision gate by confidence thresholds loaded from model metadata.
      // mlResult.source already applies mlPrimary threshold in ModelService.
      let finalDecision = decision;
      if (mlResult.modelUsed && mlResult.source === 'ML' && mlResult.action) {
        finalDecision = {
          ...decision,
          action: mlAction,
          confidence: mlConfidence,
          reason: `[ML_PRIMARY] confidence=${mlConfidence.toFixed(2)} inference=${mlResult.inferenceMs.toFixed(3)}ms. ${decision.reason}`,
        };
        this.logger.log(
          `[ML_PRIMARY] ${normalizedInput.id} action=${mlAction} confidence=${mlConfidence.toFixed(3)} inference_ms=${mlResult.inferenceMs.toFixed(3)}`,
        );
        if (mlResult.topFeatures && mlResult.topFeatures.length > 0) {
          const topFeatStr = mlResult.topFeatures
            .map(f => `${f.feature}=${f.value.toFixed(3)}(score=${f.contributionScore.toFixed(4)})`)
            .join(', ');
          this.logger.log(`[ML_TOP_FEATURES] ${normalizedInput.id} source=ML ${topFeatStr}`);
        }
      } else if (
        mlResult.modelUsed &&
        mlResult.source === 'HYBRID' &&
        combinedScore >= mlThresholds.hybridMin
      ) {
        finalDecision = {
          ...decision,
          action: winnerAction,
          confidence: combinedScore,
          reason: `[HYBRID] Rules:${(rulesConfidence * 0.4).toFixed(2)} + ML:${(mlConfidence * 0.4).toFixed(2)} + Learning:${((learningBoost + 0.10) * 0.2).toFixed(2)} = ${combinedScore.toFixed(2)} (${winnerSource.toUpperCase()} winner, threshold=${mlThresholds.hybridMin.toFixed(2)}). ${decision.reason}`,
        };
        this.logger.log(
          `[HYBRID] ${normalizedInput.id} combined=${combinedScore.toFixed(2)} rules=${rulesConfidence.toFixed(2)} ml=${mlConfidence.toFixed(2)} inference_ms=${mlResult.inferenceMs.toFixed(3)} -> ${winnerAction}`,
        );
        if (mlResult.topFeatures && mlResult.topFeatures.length > 0) {
          const topFeatStr = mlResult.topFeatures
            .map(f => `${f.feature}=${f.value.toFixed(3)}(score=${f.contributionScore.toFixed(4)})`)
            .join(', ');
          this.logger.log(`[ML_TOP_FEATURES] ${normalizedInput.id} source=HYBRID ${topFeatStr}`);
        }
      } else {
        // Low confidence or ONNX failure: fallback to rules.
        finalDecision = {
          ...decision,
          confidence: rulesConfidence,
          reason: `[RULES_FALLBACK] ml_confidence=${mlConfidence.toFixed(2)} source=${mlResult.source} modelUsed=${mlResult.modelUsed} error=${mlResult.error ?? 'none'}. ${decision.reason}`,
        };
        this.logger.warn(
          `[RULES_FALLBACK] ${normalizedInput.id} rules_action=${decision.action} ml_conf=${mlConfidence.toFixed(2)} model_used=${mlResult.modelUsed} error=${mlResult.error ?? 'none'}`,
        );
      }

      let dlOverrideApplied = false;
      let dlAnomalyScore = 0;
      let dlThreshold = 0;
      let dlIsAnomaly = false;
      let dlSequenceIds: string[] = [];
      let dlSequenceLength = 0;

      // --- DL Anomaly/Sequence Augmentation ---
      // If DL model detects strong anomaly, override to a conservative action.
      if (this.dlPredictorService) {
        const dlResult = await this.dlPredictorService.predictAnomaly(normalizedInput);
        dlAnomalyScore = dlResult.anomalyScore;
        dlThreshold = dlResult.threshold;
        dlIsAnomaly = dlResult.isAnomaly;
        dlSequenceIds = dlResult.sourceEventIds;
        dlSequenceLength = dlResult.sequenceUsed.length;

        this.logger.log(
          `[DL_SIGNAL] ${normalizedInput.id} anomaly_score=${dlResult.anomalyScore.toFixed(4)} threshold=${dlResult.threshold.toFixed(4)} is_anomaly=${dlResult.isAnomaly} sequence_len=${dlResult.sequenceUsed.length} sequence_ids=${dlResult.sourceEventIds.join('|')}`,
        );

        if (dlResult.available && dlResult.isAnomaly) {
          finalDecision = {
            ...finalDecision,
            action: 'retry_with_backoff',
            confidence: Math.max(finalDecision.confidence, dlResult.anomalyScore),
            reason: `[DL_ANOMALY_OVERRIDE] score=${dlResult.anomalyScore.toFixed(4)} threshold=${dlResult.threshold.toFixed(4)}. ${finalDecision.reason}`,
          };
          dlOverrideApplied = true;
          this.logger.warn(
            `[DL_OVERRIDE] ${normalizedInput.id} override_action=retry_with_backoff anomaly_score=${dlResult.anomalyScore.toFixed(4)} original_action=${decision.action}`,
          );
        }
      }

      // Store ML prediction for accuracy tracking
      predictionTrace = {
        modelAction: mlAction,
        modelConfidence: mlConfidence,
        rulesAction: decision.action,
        rulesConfidence,
        combinedScore,
        winnerAction,
        winnerSource,
        learningBoost,
        inferenceMs: mlResult.inferenceMs,
        modelSource: mlResult.source,
        features: {
          hourOfDay: mlFeatures.hourOfDay,
          dayOfWeek: mlFeatures.dayOfWeek,
          isStrongAction: mlFeatures.isStrongAction,
          isWeakAction: mlFeatures.isWeakAction,
          strategyConfidence: mlFeatures.strategyConfidence,
          actionRiskScore: mlFeatures.actionRiskScore,
        },
        onnxFeatureVector: mlResult.featureVector,
        topFeatures: mlResult.topFeatures ?? [],
        dlAnomalyScore,
        dlThreshold,
        dlIsAnomaly,
        dlSequenceLength,
        dlSequenceEventIds: dlSequenceIds,
        dlOverrideApplied,
      };

      const mlAccuracyRecord = {
        timestamp: new Date().toISOString(),
        incidentId: normalizedInput.id,
        prediction: predictionTrace,
      };

      // For now, log the ML accuracy record (persistence can be added later)
      this.logger.debug(`[ML_ACCURACY_RECORD] ${JSON.stringify(mlAccuracyRecord)}`);

      decision = finalDecision;

      // === CAPTURE DECISION FOR ONLINE LEARNING (FASE 1) ===
      // Save to online training buffer for micro-batch learning
      if (!isDryRun) {
        this.persistenceService.fireAndForget(
          (async () => {
            const modelVersion = this.modelService.getModelVersion?.() ?? 'v1';
            const featureBuilder = this.modelService.getFeatureBuilder?.();
            const featureNames = featureBuilder?.getFeatureNames() ?? [];

            await this.persistenceService.saveOnlineTrainingRecord(
              normalizedInput.id,
              normalizedInput.source,
              normalizedInput,
              mlFeatures as unknown as Record<string, number>,
              mlResult.featureVector ?? [],
              featureNames,
              {
                modelAction: mlAction,
                modelConfidence: mlConfidence,
                mlSource: mlResult.source,
                topFeatures: mlResult.topFeatures ?? [],
              },
              finalDecision.action,
              finalDecision.confidence,
              modelVersion,
            );
          })(),
          `[OnlineTraining] Save buffer record for ${normalizedInput.id}`,
        );
      }

      // --- Phase 3: Decision Guard ---
      const decisionVerdict = this.guardService.validateDecision(decision);
      if (!decisionVerdict.allowed) {
        const reason = decisionVerdict.reasons.join('; ');
        this.logger.log(`[BLOCKED/decision] ${normalizedInput.id} — ${reason} (confidence=${decision.confidence})`);
        if (!isDryRun) {
          this.persistenceService.fireAndForget(
            this.persistenceService.updateOnlineTrainingOutcome(
              normalizedInput.id,
              'blocked',
              false,
              reason,
            ),
            `[OnlineTraining] update outcome blocked for ${normalizedInput.id}`,
          );
        }
        this.auditSafe(normalizedInput, diagnosisCode, decision, action, 'BLOCKED', null, reason);
        if (!isDryRun) {
          this.learningService?.recordBlocked(decision.action);
        }
        return {
          status: 'BLOCKED',
          action: decision.action,
          reason,
          execution: null,
          meta: { reasons: decisionVerdict.reasons, confidence: decision.confidence },
        };
      }

      if (isDryRun) {
        this.logger.log(`[DRY_RUN] ${normalizedInput.id} — returning ML+rules decision without execution`);
        this.auditSafe(
          normalizedInput,
          diagnosisCode,
          decision,
          action,
          'SIMULATED',
          null,
          undefined,
          predictionTrace,
        );
        return {
          status: 'SIMULATED',
          action: decision.action,
          reason: `[DRY_RUN] ${decision.reason}`,
          execution: null,
          meta: {
            incidentId: normalizedInput.id,
            diagnosisCode,
            dryRun: true,
            prediction: predictionTrace,
          },
        };
      }

      // --- Phase 4: AI Enhancement (never throws) ---
      const aiHint = await this.aiService.suggestEnhancement(normalizedInput, decision);
      decision = { ...decision, reason: `${decision.reason}. AI: ${aiHint}` };

      // --- Phase 5: Build action envelope ---
      action = this.actionService.execute(decision);

      // --- Phase 6: Execution Gate ---
      executionResult = await this.executionService.gate(action, decision);

      const isReal = executionResult.executed && !executionResult.simulated;
      const isSimulated = !executionResult.executed && executionResult.simulated;

      const executionStatus = isReal ? 'EXECUTED' : isSimulated ? 'SIMULATED' : 'SUCCESS';

      this.eventProducer.publish('action.executed', {
        incidentId: normalizedInput.id,
        action: decision.action,
        executed: executionResult.executed,
        simulated: executionResult.simulated,
        reason: executionResult.reason,
      });

      const realOutcome = this.resolveRealOutcome(executionResult);

      this.persistenceService.fireAndForget(
        this.persistenceService.updateOnlineTrainingOutcome(
          normalizedInput.id,
          realOutcome,
          executionResult.executed,
          executionResult.error ?? undefined,
        ),
        `[OnlineTraining] update outcome for ${normalizedInput.id}`,
      );

      this.memoryService.rememberIncident(normalizedInput, decision, {
        success: executionResult.executed,
        action: action.command,
        details: executionResult.output,
        rollbackSuggested: false,
      }, {
        prediction: predictionTrace,
        realOutcome,
      });

      this.learningService?.record(normalizedInput, decision, executionResult, {
        prediction: predictionTrace,
      });

      this.auditSafe(
        normalizedInput,
        diagnosisCode,
        decision,
        action,
        executionStatus,
        executionResult,
        undefined,
        predictionTrace,
      );

      return {
        status: executionStatus,
        action: decision.action,
        reason: decision.reason,
        execution: executionResult,
        meta: {
          incidentId: normalizedInput.id,
          diagnosisCode,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[FALLBACK] ${normalizedInput.id ?? input.id} — ${message}`);
      this.persistenceService.fireAndForget(
        this.persistenceService.updateOnlineTrainingOutcome(
          normalizedInput.id ?? input.id,
          'failure',
          false,
          message,
        ),
        `[OnlineTraining] update outcome failure for ${normalizedInput.id ?? input.id}`,
      );
      this.auditSafe(normalizedInput, diagnosisCode, decision, action, 'FAILED', null, message);

      return {
        status: 'FALLBACK',
        action: decision?.action ?? '',
        reason: message,
        execution: null,
        meta: {
          incidentId: normalizedInput.id ?? input.id,
          diagnosisCode,
        },
      };
    }
  }

  private auditSafe(
    input: IncidentPayload,
    diagnosisCode: string | undefined,
    decision: BrainDecision | undefined,
    action: ActionEnvelope | undefined,
    status: 'SUCCESS' | 'EXECUTED' | 'SIMULATED' | 'FAILED' | 'BLOCKED',
    executionResult: GatedExecutionResult | null,
    errorMsg?: string,
    predictionTrace?: MlPredictionTrace,
  ): void {
    try {
      const auditStatus: 'SUCCESS' | 'FAILED' | 'BLOCKED' =
        status === 'EXECUTED' || status === 'SIMULATED' || status === 'SUCCESS'
          ? 'SUCCESS'
          : status === 'BLOCKED'
            ? 'BLOCKED'
            : 'FAILED';

      this.auditService.logProcess({
        incidentId: input.id,
        source: input.source,
        status: auditStatus,
        diagnosisCode,
        decisionAction: decision?.action,
        actionType: action?.type,
        ...(predictionTrace ? { prediction: predictionTrace } : {}),
        ...(executionResult ? { realOutcome: this.resolveRealOutcome(executionResult) } : {}),
        ...(errorMsg ? { error: errorMsg } : {}),
        ...(executionResult
          ? {
              error: executionResult.error ?? undefined,
            }
          : {}),
      });
    } catch (auditErr) {
      const msg = auditErr instanceof Error ? auditErr.message : String(auditErr);
      this.logger.error(`Audit write failed: ${msg}`);
    }
  }

  private resolveRealOutcome(
    executionResult: GatedExecutionResult | null,
  ): 'success' | 'failure' | 'blocked' | 'simulated' {
    if (executionResult === null) return 'failure';
    if (executionResult.simulated) return 'simulated';
    if (executionResult.executed) return 'success';
    return executionResult.reason.toLowerCase().includes('blocked') ? 'blocked' : 'failure';
  }

  private buildDefaultEnrichedDiagnosis(fingerprint: ErrorFingerprint): EnrichedDiagnosis {
    return {
      diagnosis: fingerprint,
      recentFailures: 0,
      repeatDetected: false,
      shouldThrottle: false,
      shouldBlockAction: false,
      pattern: 'none',
      repeatedAction: null,
      weakActions: [],
      strongActions: [],
      actionRiskScore: 0,
    };
  }

  private attachSystemBrainContext(input: IncidentPayload, enrichedDiagnosis: EnrichedDiagnosis): IncidentPayload {
    return {
      ...input,
      metadata: {
        ...(input.metadata ?? {}),
        systemBrain: {
          recentFailures: enrichedDiagnosis.recentFailures,
          repeatDetected: enrichedDiagnosis.repeatDetected,
          shouldThrottle: enrichedDiagnosis.shouldThrottle,
          shouldBlockAction: enrichedDiagnosis.shouldBlockAction,
          pattern: enrichedDiagnosis.pattern,
          weakActions: enrichedDiagnosis.weakActions,
          strongActions: enrichedDiagnosis.strongActions,
          actionRiskScore: enrichedDiagnosis.actionRiskScore,
        },
      },
    };
  }

  private applySystemBrainDecisionSafety(
    decision: BrainDecision,
    enrichedDiagnosis: EnrichedDiagnosis,
  ): BrainDecision {
    const isWeakAction = enrichedDiagnosis.weakActions.includes(decision.action);
    const isStrongAction = enrichedDiagnosis.strongActions.includes(decision.action);

    const combinedBlock =
      enrichedDiagnosis.repeatedAction !== null &&
      enrichedDiagnosis.repeatedAction === decision.action &&
      isWeakAction;

    if (enrichedDiagnosis.shouldBlockAction || combinedBlock) {
      return {
        ...decision,
        confidence: 0.1,
        reason: `${decision.reason}. SystemBrain: anti_loop_block pattern=${enrichedDiagnosis.pattern} riskScore=${enrichedDiagnosis.actionRiskScore}`,
      };
    }

    let confidence = decision.confidence;
    const reasonParts: string[] = [];

    if (isWeakAction) {
      confidence = Math.max(0, confidence - 0.15);
      reasonParts.push('weak_action_penalized');
    } else if (isStrongAction) {
      confidence = Math.min(1.0, confidence + 0.05);
      reasonParts.push('strong_action_boosted');
    }

    if (enrichedDiagnosis.shouldThrottle) {
      confidence = Math.min(confidence, 0.8);
      reasonParts.push(`throttled_context recentFailures=${enrichedDiagnosis.recentFailures}`);
    }

    const fullRiskScore = enrichedDiagnosis.actionRiskScore + (isWeakAction ? 2 : 0);
    reasonParts.push(
      `pattern=${enrichedDiagnosis.pattern} repeatDetected=${enrichedDiagnosis.repeatDetected} riskScore=${fullRiskScore}`,
    );

    return {
      ...decision,
      confidence,
      reason: `${decision.reason}. SystemBrain: ${reasonParts.join(' ')}`,
    };
  }
}
