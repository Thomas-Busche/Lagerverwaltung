/**
 * Short-lived helper tokens (MFA challenge/setup) and refresh tokens are signed with the
 * same secret as access tokens. Access tokens carry no tokenType, so any token that does
 * carry one must never be accepted as an access token (would bypass MFA).
 */
export function isAccessTokenPayload(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  return (payload as { tokenType?: unknown }).tokenType === undefined;
}
