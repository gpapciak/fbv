import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'info@fincabuenavida.org';

function lotLabel(n: number): string {
  if (n >= 200) return `I${n - 200}`;
  if (n >= 100) return `S${n - 100}`;
  return String(n);
}

function lotType(n: number): string {
  return n >= 200 ? 'Inland' : 'Shore';
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, record, old_record } = payload;

    // Only act on UPDATE events where status just changed to for_sale
    if (type !== 'UPDATE') return new Response('ok', { status: 200 });
    if (record.status !== 'for_sale' || old_record?.status === 'for_sale') {
      return new Response('ok', { status: 200 });
    }

    const lotName = lotLabel(record.lot_number);
    const kind    = lotType(record.lot_number);
    const price   = record.price || 'Not set';
    const ts      = new Date(record.updated_at).toLocaleString('en-US', {
      timeZone: 'America/Panama',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Look up owner — service role key is auto-injected by Supabase runtime
    let ownerName  = 'Unknown';
    let ownerEmail = 'Unknown';

    if (record.updated_by) {
      const sb = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: owner } = await sb
        .from('owners')
        .select('name, email')
        .eq('id', record.updated_by)
        .single();
      if (owner) {
        ownerName  = owner.name;
        ownerEmail = owner.email;
      }
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY secret not set');
      return new Response('missing key', { status: 500 });
    }

    const body = [
      `New lot listing — Finca Buena Vida`,
      ``,
      `Lot:     ${lotName} (${kind})`,
      `Status:  For Sale`,
      `Price:   ${price}`,
      ``,
      `Owner:   ${ownerName}`,
      `Email:   ${ownerEmail}`,
      ``,
      `Updated: ${ts} (Panama time)`,
      ``,
      `—`,
      `Automated notification from the FBV member portal.`,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FBV Portal <portal@fincabuenavida.org>',
        to:   [ADMIN_EMAIL],
        subject: `Lot ${lotName} listed for sale — FBV`,
        text: body,
      }),
    });

    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return new Response('email failed', { status: 500 });
    }

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('Function error:', err);
    return new Response('error', { status: 500 });
  }
});
