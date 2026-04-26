/**
 * Natural Language Processing utilities for Spanish.
 * Módulos determinísticos sin dependencia de IA.
 */

export {
  detectNegation,
  detectBlockingNegation,
  analyzeNegations,
  type NegationResult,
  _internal as negationInternal,
} from "./negation-detector";
