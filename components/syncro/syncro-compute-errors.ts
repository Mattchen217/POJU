export type SyncroComputeErrorView = {
  title: string;
  message: string;
};

export function formatSyncroComputeError(
  error: unknown,
  t: (key: string) => string,
): SyncroComputeErrorView {
  const errorMsg = (
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error)
  ).toLowerCase();

  if (
    errorMsg.includes("load failed") ||
    errorMsg.includes("failed to fetch") ||
    errorMsg.includes("networkerror") ||
    errorMsg.includes("network error")
  ) {
    return {
      title: t("error.network_title"),
      message: t("error.network_message"),
    };
  }

  if (
    errorMsg.includes("timeout") ||
    errorMsg.includes("abort") ||
    errorMsg.includes("llm_timeout") ||
    errorMsg.includes("non_json_response") ||
    errorMsg.includes("invalid_json_response") ||
    errorMsg.includes("empty_response") ||
    errorMsg.includes("the string did not match the expected pattern")
  ) {
    return {
      title: t("error.timeout_title"),
      message: t("error.timeout_message"),
    };
  }

  if (errorMsg.includes("invalid_location") || errorMsg.includes("missing_data")) {
    return {
      title: t("error.location_title"),
      message: t("error.location_message"),
    };
  }

  return {
    title: t("error.generic_title"),
    message: t("error.generic_message"),
  };
}
