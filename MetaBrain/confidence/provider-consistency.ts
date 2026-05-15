import type { ProviderConsistencyResult, ProviderOutputSummary } from "./types";

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function similarity(left: string, right: string): number {
  if (!left && !right) return 0;
  if (left === right) return 1;
  const leftTerms = new Set(left.split(" ").filter(Boolean));
  const rightTerms = new Set(right.split(" ").filter(Boolean));
  const intersection = [...leftTerms].filter((term) => rightTerms.has(term)).length;
  const union = new Set([...leftTerms, ...rightTerms]).size || 1;
  return intersection / union;
}

export function evaluateProviderConsistency(outputs: ProviderOutputSummary[]): ProviderConsistencyResult {
  const usable = outputs.filter((output) => output.status === "ok" && normalize(output.content_summary));
  const unresolved: string[] = outputs
    .filter((output) => output.status !== "ok")
    .map((output) => `${output.provider_name}:${output.status}`);

  if (usable.length < 2) {
    return {
      providers_compared: usable.length,
      consistency_score: usable.length === 1 ? 0.7 : 0,
      conflicts_detected: unresolved.length > 0,
      dominant_provider: usable[0]?.provider_name,
      unresolved_conflicts: unresolved,
    };
  }

  const comparisons: number[] = [];
  for (let index = 0; index < usable.length; index += 1) {
    for (let next = index + 1; next < usable.length; next += 1) {
      comparisons.push(similarity(normalize(usable[index].content_summary), normalize(usable[next].content_summary)));
    }
  }

  const score = comparisons.reduce((sum, value) => sum + value, 0) / comparisons.length;
  if (score < 0.45) unresolved.push("provider_output_divergence");

  return {
    providers_compared: usable.length,
    consistency_score: Number(score.toFixed(3)),
    conflicts_detected: unresolved.length > 0,
    dominant_provider: usable.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0))[0]?.provider_name,
    unresolved_conflicts: unresolved,
  };
}
