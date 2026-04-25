import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Lazy Stripe client. Throws on first call if STRIPE_SECRET_KEY is unset --
 * we'd rather fail loudly at the first request than 500 silently.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, { typescript: true })
  }
  return _stripe
}

/**
 * Production startup guard for Stripe webhook signature verification.
 *
 * W2.6 (finding C-6): the previous duplicate webhook handler at
 * /api/webhooks/stripe accepted UNSIGNED events when
 * STRIPE_WEBHOOK_SECRET was unset, allowing forged subscription events.
 * The duplicate is deleted and the canonical handler at /api/stripe/webhook
 * always verifies. This function is a belt-and-suspenders check called
 * from the canonical handler; in production it raises if the secret is
 * missing instead of silently parsing the event.
 *
 * Returns the secret string if set; throws Error otherwise.
 */
export function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
      throw new Error('STRIPE_WEBHOOK_SECRET is required in production')
    }
    // Dev-only convenience: warn loudly but allow through. Local Stripe
    // CLI users (`stripe listen --forward-to localhost:3000/api/stripe/webhook`)
    // will have the secret; if not, this surface is fine on a laptop.
    console.warn(
      '[webhook] STRIPE_WEBHOOK_SECRET not set in non-production env; ' +
        'signature verification will be skipped. Run `stripe listen` to test.',
    )
    return ''
  }
  return secret
}
