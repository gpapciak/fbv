/**
 * Finca Buena Vida — Netlify Function: stripe-webhook
 * Handles Stripe webhook events.
 * On payment_intent.succeeded: marks the matching dues row as paid.
 *
 * Setup in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL: https://your-site.netlify.app/.netlify/functions/stripe-webhook
 *   Events to send: payment_intent.succeeded
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Webhook signature verification failed: ' + err.message };
  }

  if (stripeEvent.type === 'payment_intent.succeeded') {
    const intent = stripeEvent.data.object;
    const { dueId, feeCents, originalAmountCents } = intent.metadata || {};

    if (!dueId) {
      console.warn('payment_intent.succeeded with no dueId in metadata — skipping');
      return { statusCode: 200, body: 'OK (no dueId)' };
    }

    // Use service role key to bypass RLS
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await sb.from('dues').update({
      paid_at: new Date().toISOString(),
      payment_method: 'stripe_card',
      stripe_payment_intent_id: intent.id,
    }).eq('id', dueId);

    if (error) {
      console.error('Failed to update dues row:', error.message);
      // Return 200 so Stripe doesn't retry — log the error and investigate
      return { statusCode: 200, body: 'DB update failed: ' + error.message };
    }

    console.log('Dues marked paid:', { dueId, intentId: intent.id, originalAmountCents, feeCents });
  }

  return { statusCode: 200, body: 'OK' };
};
