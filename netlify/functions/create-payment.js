/**
 * Finca Buena Vida — Netlify Function: create-payment
 * Creates a Stripe PaymentIntent for HOA dues.
 * Optionally passes through the processing fee to the payer.
 */

const Stripe = require('stripe');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method not allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { dueId, amountCents, ownerEmail, passthrough } = JSON.parse(event.body);

    if (!dueId || !amountCents || !ownerEmail) {
      return {
        statusCode: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: dueId, amountCents, ownerEmail' }),
      };
    }

    let totalCents = amountCents;
    let feeCents = 0;

    // Pass the processing fee through to the payer (2.9% + $0.30)
    if (passthrough) {
      feeCents = Math.round(amountCents * 0.029 + 30);
      totalCents = amountCents + feeCents;
    }

    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      receipt_email: ownerEmail,
      metadata: {
        dueId,
        feeCents: String(feeCents),
        originalAmountCents: String(amountCents),
      },
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSecret: intent.client_secret,
        feeCents,
        totalCents,
      }),
    };
  } catch (err) {
    console.error('create-payment error:', err.message);
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
