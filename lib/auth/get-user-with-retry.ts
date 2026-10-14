import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  isTransientAuthFetchError,
  withTransientNetworkRetry,
  type TransientNetworkRetryOptions,
} from "@/lib/client/transient-network-retry";

export type GetUserResult = {
  data: { user: User | null };
  error: Error | null;
};

/**
 * supabase.auth.getUser() with bounded retries on transient disconnects
 * (Case A: Supabase /user ERR_CONNECTION_CLOSED). Permanent auth errors
 * (missing session, invalid JWT) are returned as-is — never coerced to success.
 */
export async function getUserWithTransientRetry(
  supabase: SupabaseClient,
  options: Omit<TransientNetworkRetryOptions, "onRetry"> & {
    onRetry?: TransientNetworkRetryOptions["onRetry"];
  } = {},
): Promise<GetUserResult> {
  return withTransientNetworkRetry(async () => {
    const result = await supabase.auth.getUser();
    if (result.error && isTransientAuthFetchError(result.error)) {
      throw result.error;
    }
    return {
      data: { user: result.data.user ?? null },
      error: (result.error as Error | null) ?? null,
    };
  }, options);
}
