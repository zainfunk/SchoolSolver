import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Server-side, RLS-respecting Supabase client.
 *
 * Lives in its own file (separate from `lib/supabase.ts`) because the
 * `auth()` import from `@clerk/nextjs/server` is marked `server-only`,
 * and several client components import the browser `supabase` instance
 * from `lib/supabase.ts`. Mixing the two trips Turbopack with
 * "'server-only' cannot be imported from a Client Component module."
 *
 * Closes part of finding C-8 (W2.4).
 */
export async function createAuthedServerClient() {
  const { getToken } = await auth()
  const token = (await getToken()) ?? null
  return createClient(url, anonKey, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
