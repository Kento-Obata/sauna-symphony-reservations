// Shared rate-limiting helpers for public (verify_jwt = false) edge functions.
//
// Failed authorization attempts are recorded in public.auth_attempts and counted
// within a sliding window. Both a per-resource identifier (e.g. reservation code)
// and the caller IP are tracked so that:
//   - brute-forcing one reservation's phone digits gets locked out, and
//   - scanning many reservation codes from one IP gets locked out.
//
// Edge functions connect via POSTGRES_URL (direct postgres role) which bypasses
// RLS, so the table keeps RLS enabled with no policies (deny-all to anon/auth).

export interface RateRule {
  action: string;
  identifier: string;
  max: number;
  windowMinutes: number;
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Returns true if any rule has reached its limit of failed attempts in its window.
export async function isRateLimited(sql: any, rules: RateRule[]): Promise<boolean> {
  for (const rule of rules) {
    const rows = await sql`
      select count(*)::int as c
      from public.auth_attempts
      where action = ${rule.action}
        and identifier = ${rule.identifier}
        and succeeded = false
        and created_at > now() - make_interval(mins => ${rule.windowMinutes})
    `;
    if ((rows[0]?.c ?? 0) >= rule.max) return true;
  }
  return false;
}

export async function recordAttempt(
  sql: any,
  action: string,
  identifiers: string[],
  succeeded: boolean,
): Promise<void> {
  for (const identifier of identifiers) {
    await sql`
      insert into public.auth_attempts (action, identifier, succeeded)
      values (${action}, ${identifier}, ${succeeded})
    `;
  }
}
