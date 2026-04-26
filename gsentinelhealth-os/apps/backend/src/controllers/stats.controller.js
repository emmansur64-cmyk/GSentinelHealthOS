import { getTodayStats } from "../services/stats.service.js";

export async function getTodayStatsController(_, res) {
  const stats = await getTodayStats();
  res.json(stats);
}
