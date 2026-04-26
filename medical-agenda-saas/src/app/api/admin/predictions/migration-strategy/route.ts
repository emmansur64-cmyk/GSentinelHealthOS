import { fail, ok } from "@/lib/api-response";
import { getShadowModeStrategySnapshot } from "@/lib/ai/shadowModeStrategy";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function GET(): Promise<Response> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return fail("No autenticado", 401);
  if (String(authUser.role).toLowerCase() !== "admin") return fail("Sin permisos", 403);

  const strategy = getShadowModeStrategySnapshot();

  return ok({
    generated_at: new Date().toISOString(),
    strategy,
    phases: [
      {
        id: "stage_0",
        name: "Baseline Heuristico",
        objective: "Consolidar calidad de labels y observabilidad del modelo actual.",
        rollout: "100% heuristic",
      },
      {
        id: "stage_1",
        name: "Shadow Mode",
        objective: "Evaluar modelo Python en paralelo sin impacto en decisiones productivas.",
        rollout: "0% serving / 100% score paralelo",
      },
      {
        id: "stage_2",
        name: "Canary A/B",
        objective: "Habilitar por segmentos controlados y medir delta de KPI.",
        rollout: `${Math.round(strategy.abTrafficRatio * 100)}% candidate / ${Math.round((1 - strategy.abTrafficRatio) * 100)}% control`,
      },
      {
        id: "stage_3",
        name: "Cutover",
        objective: "Promover modelo Python a principal con fallback inmediato al heuristico.",
        rollout: "100% candidate con rollback de 1 click",
      },
    ],
    go_no_go_kpis: {
      max_brier_delta: strategy.maxAllowedDelta,
      min_shadow_samples: 500,
      min_ab_samples: 200,
      max_prediction_p95_ms: 350,
    },
  });
}
