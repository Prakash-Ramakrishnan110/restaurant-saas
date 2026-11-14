import i18n from "../i18n";

export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, any>;
  };
  code?: string;
  message?: string;
  detail?: string;
}

export function mapBackendErrorCode(err: any): string {
  const code =
    err?.response?.data?.error?.code || err?.response?.data?.code || err?.error?.code || err?.code;

  if (code && i18n.exists(`errors.${code}`)) {
    return i18n.t(`errors.${code}`);
  }

  const message =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.response?.data?.detail ||
    err?.error?.message ||
    err?.message;

  return message || "An unexpected error occurred. Please try again.";
}
