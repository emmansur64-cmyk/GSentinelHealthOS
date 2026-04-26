import { getSettings, updateSettings } from "../services/settings.service.js";

export async function getSettingsController(_, res) {
  const data = await getSettings();
  res.json(data);
}

export async function updateSettingsController(req, res) {
  const data = await updateSettings(req.validated.body);
  res.json(data);
}
