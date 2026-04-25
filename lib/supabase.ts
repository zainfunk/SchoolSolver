import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let accessTokenResolver: (() => Promise<string | null>) | null = null

export function setSupabaseAccessTokenResolver(
  resolver: (() => Promise<string | null>) | null
) {
  accessTokenResolver = resolver
}

// Client-side: uses the Clerk session token so Supabase can enforce RLS.
export const supabase = createClient(url, anonKey, {
  async accessToken() {
    return accessTokenResolver ? accessTokenResolver() : null
  },
})

/**
 * Server-side only: bypasses RLS. NEVER import in client components.
 *
 * Every call site MUST be listed in
 * docs/security/W2.4-SERVICE-ROLE-INVENTORY.md with a justification.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

export function createServerSupabaseClient(getAccessToken: () => Promise<string | null>) {
  return createClient(url, anonKey, {
    accessToken: getAccessToken,
  })
}

// NOTE: `createAuthedServerClient` lives in `lib/supabase-server.ts`
// because it imports `auth` from `@clerk/nextjs/server`, which carries
// a `server-only` marker. Importing it here would poison every client
// component that pulls in the `supabase` instance above. Routes that
// need RLS-respecting reads should import from `'@/lib/supabase-server'`.
