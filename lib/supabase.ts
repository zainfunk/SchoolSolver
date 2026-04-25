import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

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
 * Server-side, RLS-respecting Supabase client.
 *
 * Carries the caller's Clerk session token so PostgREST sees the right
 * `auth.jwt()->>'sub'` and RLS policies authorize the request as the
 * caller, not as the service role. This is the *preferred* server
 * client.
 *
 * Use `createServiceClient` (below) only when justified per
 * `docs/security/W2.4-SERVICE-ROLE-INVENTORY.md`.
 *
 * Closes part of finding C-8.
 */
export async function createAuthedServerClient() {
  const { getToken } = await auth()
  const token = (await getToken()) ?? null
  return createClient(url, anonKey, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Server-side only: bypasses RLS. NEVER import in client components.
 *
 * Every call site MUST be listed in
 * docs/security/W2.4-SERVICE-ROLE-INVENTORY.md with a justification.
 * New service-role usage requires a code-review approval per the
 * checklist there.
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
