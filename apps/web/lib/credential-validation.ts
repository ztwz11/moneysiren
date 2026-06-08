import {
  createCloudflareBillingUsageClient,
} from "../../../packages/connectors/cloudflare/src/index";
import {
  createOpenAiUsageCostsClient,
  createCurrentOpenAiUsageCostsPeriod,
} from "../../../packages/connectors/openai/src/index";
import {
  createSupabaseManagementClient,
} from "../../../packages/connectors/supabase/src/index";
import type { LiveProviderKey } from "./provider-catalog";

export interface CredentialValidationInput {
  secret: string;
  accountIds?: string;
}

export interface CredentialValidationResult {
  validatedAt: string;
}

export async function validateReadOnlyCredential(
  providerKey: LiveProviderKey,
  input: CredentialValidationInput,
  now: Date = new Date(),
): Promise<CredentialValidationResult> {
  if (providerKey === "aws") {
    throw new Error("AWS raw access keys are not stored by StackSpend. Use AWS_PROFILE or SDK SSO setup.");
  }

  if (providerKey === "openai") {
    await createOpenAiUsageCostsClient({
      adminKey: input.secret,
    }).fetchUsageCosts(createCurrentOpenAiUsageCostsPeriod(now));
    return {
      validatedAt: now.toISOString(),
    };
  }

  if (providerKey === "supabase") {
    await createSupabaseManagementClient({
      accessToken: input.secret,
    }).fetchUsageHealth();
    return {
      validatedAt: now.toISOString(),
    };
  }

  await createCloudflareBillingUsageClient({
    apiToken: input.secret,
    accountIds: readCloudflareAccountIds(input.accountIds),
  }).fetchBillingUsage();

  return {
    validatedAt: now.toISOString(),
  };
}

function readCloudflareAccountIds(value: string | undefined): string[] {
  const accountIds = (value ?? "")
    .split(",")
    .map((accountId) => accountId.trim())
    .filter((accountId) => accountId.length > 0);

  if (accountIds.length === 0) {
    throw new Error("Cloudflare account IDs are required for read-only validation.");
  }

  return accountIds;
}
