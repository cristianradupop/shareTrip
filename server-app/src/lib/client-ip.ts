import { getIP } from "better-auth/api";

/** Shared by `auth.ts` (Better Auth's own rate limit) and the sign-up limiter, so both see the same client IP. */
export const IP_ADDRESS_OPTIONS: { ipAddressHeaders: string[] } = { ipAddressHeaders: ["x-forwarded-for"] };

export function clientIp(req: Request): string | null {
  return getIP(req, { advanced: { ipAddress: IP_ADDRESS_OPTIONS } });
}
