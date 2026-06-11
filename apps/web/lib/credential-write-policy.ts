export const CREDENTIAL_WRITES_DISABLED_MESSAGE =
  "StackSpend v0.1 uses environment variables only. Local credential and OAuth token writes are disabled.";

export function credentialWritesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.STACKSPEND_ENABLE_LOCAL_CREDENTIAL_WRITES?.trim().toLowerCase();

  return value === "1" || value === "true";
}
