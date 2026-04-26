export function healthController(_, res) {
  res.json({
    status: "ok",
    service: "gsentinelhealth-backend",
  });
}
