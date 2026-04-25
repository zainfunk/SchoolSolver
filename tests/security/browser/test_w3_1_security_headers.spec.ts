import { expect, test } from "@playwright/test";

// W3.1 — Regression test for the security headers added in next.config.ts.
//
// We deliberately avoid Playwright's `page.goto` here; we want to inspect the
// raw HTTP response without a browser potentially following redirects or
// hiding headers. We use the `request` fixture instead.
//
// Note on secret-pattern false positives: the husky pre-commit hook matches
// patterns like `sk_test_<20+ chars>` literally. The regex literal below uses
// a character class (`[A-Za-z0-9]`) so it does not match itself.
const SECRET_PATTERN_REFERENCE = /sk_(test|live)_[A-Za-z0-9]{20,}/; // not a real key; documentation-only.
void SECRET_PATTERN_REFERENCE;

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Case-insensitive header lookup. Node/undici lower-cases header names but
 * Playwright's `headers()` returns them as the server emitted them, so do the
 * comparison ourselves.
 */
function getHeader(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

test.describe("W3.1 security headers", () => {
  test("GET / returns all required security headers", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`, {
      maxRedirects: 0,
    });

    // Any 2xx/3xx is fine — Clerk middleware may redirect unauthenticated
    // users to /sign-in, but security headers must still be present on the
    // initial response.
    expect(response.status(), "expected a non-error status").toBeLessThan(500);

    const headers = response.headers();

    // --- Presence checks ----------------------------------------------------
    const csp = getHeader(headers, "Content-Security-Policy-Report-Only");
    expect(csp, "Content-Security-Policy-Report-Only must be present").toBeTruthy();

    const sts = getHeader(headers, "Strict-Transport-Security");
    expect(sts, "Strict-Transport-Security must be present").toBeTruthy();

    const xfo = getHeader(headers, "X-Frame-Options");
    expect(xfo, "X-Frame-Options must be present").toBeTruthy();

    const xcto = getHeader(headers, "X-Content-Type-Options");
    expect(xcto, "X-Content-Type-Options must be present").toBeTruthy();

    const referrer = getHeader(headers, "Referrer-Policy");
    expect(referrer, "Referrer-Policy must be present").toBeTruthy();

    const permissions = getHeader(headers, "Permissions-Policy");
    expect(permissions, "Permissions-Policy must be present").toBeTruthy();

    // --- Exact-value assertions --------------------------------------------
    expect(sts).toBe("max-age=63072000; includeSubDomains; preload");
    expect(xfo).toBe("DENY");
    expect(xcto).toBe("nosniff");
    expect(referrer).toBe("strict-origin-when-cross-origin");

    // --- CSP content sanity checks -----------------------------------------
    // We don't pin the entire CSP string (it will evolve); just enforce the
    // load-bearing directives the assessment requires.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("CSP is report-only on first deploy (not yet enforcing)", async ({
    request,
  }) => {
    // Documents the current state per the W3.1 plan: we ship report-only,
    // observe one clean deploy cycle, then flip to enforcing. If/when this
    // test starts failing because the enforcing header is set instead, that's
    // the cue to delete this test (and the report-only one above).
    const response = await request.get(`${BASE_URL}/`, { maxRedirects: 0 });
    const headers = response.headers();

    expect(
      getHeader(headers, "Content-Security-Policy-Report-Only"),
      "report-only header should be set during the W3.1 observation window",
    ).toBeTruthy();
    expect(
      getHeader(headers, "Content-Security-Policy"),
      "enforcing CSP header should NOT be set yet (still in report-only mode)",
    ).toBeUndefined();
  });
});
