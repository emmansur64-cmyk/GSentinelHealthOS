import { login } from "../services/auth.service.js";

export function loginController(req, res) {
  const result = login(req.validated.body);
  res.json(result);
}
