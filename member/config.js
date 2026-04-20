/**
 * Finca Buena Vida — Member Portal Client Configuration
 *
 * Fill in the values below after setting up your Supabase project and Stripe account.
 * These values are PUBLIC (safe to expose in the browser):
 *   - supabaseUrl:          Your Supabase project URL
 *   - supabaseAnonKey:      Your Supabase anon (public) key
 *   - stripePublishableKey: Your Stripe publishable key (pk_live_... or pk_test_...)
 *
 * NEVER put secret keys here (Supabase service role key, Stripe secret key, etc.).
 * Those belong in Netlify environment variables and are only used server-side.
 *
 * Where to find these values:
 *   Supabase:  Dashboard → Project Settings → API
 *   Stripe:    Dashboard → Developers → API Keys
 */

window.FBV_CONFIG = {
  // Supabase project URL — e.g. "https://abcdefghijkl.supabase.co"
  supabaseUrl: 'https://sybljqqbnpnvbjnrsqro.supabase.co',

  // Supabase anon key — long JWT string starting with "eyJ..."
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5YmxqcXFibnBudmJqbnJzcXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NDUzNjIsImV4cCI6MjA5MjIyMTM2Mn0.lvz0LTIFU54c_8uFXRh5Qm_nVpXDshLo2JXZSb_1PsY',

  // Stripe publishable key — starts with "pk_live_" or "pk_test_"
  stripePublishableKey: 'pk_test_your-publishable-key-here',
};
