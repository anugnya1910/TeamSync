/**
 * Maps Supabase Auth errors to friendly, non-enumerating messages (spec §B.1 error cases).
 * Never reveal whether an email address exists.
 */
export type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null };

export const GENERIC_LOGIN_ERROR = "Invalid email or password.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: GENERIC_LOGIN_ERROR,
  user_not_found: GENERIC_LOGIN_ERROR,
  email_not_confirmed: "Please confirm your email address first — check your inbox for the link.",
  over_email_send_rate_limit:
    "We've sent too many emails recently. Please wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  over_sms_send_rate_limit: "Too many attempts. Please wait a moment and try again.",
  weak_password: "That password is too weak. Use at least 8 characters with a letter and a number.",
  same_password: "Your new password must be different from the current one.",
  user_already_exists: "If that email can be used, you'll receive a confirmation email shortly.",
  email_exists: "If that email can be used, you'll receive a confirmation email shortly.",
  signup_disabled: "Sign-ups are currently disabled.",
  email_address_invalid: "Please enter a valid email address.",
  otp_expired: "That link has expired. Please request a new one.",
  flow_state_expired: "That link has expired. Please request a new one.",
  flow_state_not_found: "That link is no longer valid. Please request a new one.",
  bad_code_verifier: "That link must be opened in the same browser you requested it from.",
  session_not_found: "Your session has ended. Please sign in again.",
  reauthentication_needed: "Please sign in again before changing your password.",
  provider_disabled: "That sign-in method is not enabled.",
  validation_failed: "Please check the details you entered.",
};

export function mapAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const code = error.code ?? "";
  if (code && BY_CODE[code]) return BY_CODE[code];

  const message = (error.message ?? "").toLowerCase();
  if (message.includes("invalid login credentials")) return GENERIC_LOGIN_ERROR;
  if (message.includes("email not confirmed")) return BY_CODE.email_not_confirmed!;
  if (message.includes("rate limit")) return BY_CODE.over_email_send_rate_limit!;
  if (message.includes("expired")) return BY_CODE.otp_expired!;
  if (message.includes("password") && message.includes("weak")) return BY_CODE.weak_password!;
  if (error.status === 429) return BY_CODE.over_request_rate_limit!;
  return "Something went wrong. Please try again.";
}
