// Single source of truth for the CORS/WebSocket origin whitelist (mirrors main.ts).
export function buildAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  }
  const origins = ["http://localhost:5173", "http://localhost:3000"];
  const appHost = env.APP_HOST?.trim();
  if (appHost) {
    origins.push(`http://${appHost}`, `https://${appHost}`);
  }
  return origins;
}
