/* ===================================================
   FINCA BUENA VIDA — Member Portal
   member.js — Full portal logic (vanilla JS)
   =================================================== */

'use strict';

// =====================================================
// CONFIG & INIT
// =====================================================

const { supabaseUrl, supabaseAnonKey, stripePublishableKey } = window.FBV_CONFIG || {};

// Create Supabase client (null if not configured yet)
let sb = null;
if (
  supabaseUrl && supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-key')
) {
  sb = supabase.createClient(supabaseUrl, supabaseAnonKey);
}

// Init Stripe (null if not configured)
let stripe = (stripePublishableKey && !stripePublishableKey.includes('your-publishable-key'))
  ? Stripe(stripePublishableKey)
  : null;

// Portal state
let currentUser = null;
let currentOwner = null;
let cardElement = null; // Stripe card element reference

// Demo / placeholder mode (used when Supabase not connected)
const DEMO_MODE = !sb;

// =====================================================
// DEMO DATA — shown before real Supabase is connected
// =====================================================

const DEMO_OWNER = {
  id: 'demo-owner-1',
  user_id: 'demo-user-1',
  name: 'Demo Member',
  email: 'demo@fincabuenavidapanama.com',
  phone: '+1 555-0100',
  lot_numbers: [103, 207],
  bio: 'Placeholder profile — connect Supabase to see real member data.',
  photo_url: null,
  directory_opt_in: true,
  is_admin: true,
  created_at: '2023-01-15T00:00:00Z',
};

const DEMO_DUES = [
  { id: 'd1', owner_id: 'demo-owner-1', year: 2025, amount_cents: 60000, due_date: '2025-03-01', paid_at: '2025-02-14T10:00:00Z', payment_method: 'stripe_card', owners: { name: 'Demo Member', email: 'demo@example.com' } },
  { id: 'd2', owner_id: 'demo-owner-1', year: 2024, amount_cents: 60000, due_date: '2024-03-01', paid_at: '2024-02-20T10:00:00Z', payment_method: 'wire', owners: { name: 'Demo Member', email: 'demo@example.com' } },
  { id: 'd3', owner_id: 'demo-owner-2', year: 2025, amount_cents: 60000, due_date: '2025-03-01', paid_at: null, payment_method: null, owners: { name: 'Maria Santos', email: 'maria@example.com' } },
];

const DEMO_DIRECTORY = [
  { id: 'demo-owner-1', name: 'Demo Member', email: 'demo@example.com', lot_numbers: [103, 207], bio: 'Placeholder profile.', photo_url: null },
  { id: 'demo-owner-2', name: 'Maria Santos', email: 'maria@example.com', lot_numbers: [105], bio: 'Loves the jungle mornings and watching dolphins from the dock.', photo_url: null },
  { id: 'demo-owner-3', name: 'Carlos Rivera', email: 'carlos@example.com', lot_numbers: [202], bio: 'Builder and dreamer. Working on my forever home here.', photo_url: null },
];

const DEMO_DOCUMENTS = [
  { id: 'doc1', title: 'CC&Rs — Finca Buena Vida', category: 'covenants', year: 2020, file_url: '#', reference_only: false, reference_note: null, created_at: '2020-06-01T00:00:00Z' },
  { id: 'doc2', title: 'Annual Meeting Minutes 2024', category: 'minutes', year: 2024, file_url: '#', reference_only: false, reference_note: null, created_at: '2024-12-10T00:00:00Z' },
  { id: 'doc3', title: '2024 Financial Summary', category: 'financial', year: 2024, file_url: '#', reference_only: false, reference_note: null, created_at: '2024-12-15T00:00:00Z' },
  { id: 'doc4', title: 'Title Documents', category: 'legal', year: null, file_url: '#', reference_only: true, reference_note: 'Originals held by HOA attorney — contact board for access.', created_at: '2021-03-01T00:00:00Z' },
];

const DEMO_ANNOUNCEMENTS = [
  {
    id: 'ann1',
    title: 'Welcome to the Member Portal!',
    body: 'This is a **demo announcement**. Connect Supabase to see real board posts.\n\nWe built this portal to make community coordination easier. Use the board to ask questions, share updates, and stay connected.',
    author_id: 'demo-owner-1',
    pinned: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    owners: { name: 'Demo Member', photo_url: null },
    comments: [
      { id: 'c1', body: 'Looks great! Excited to use this.', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), owners: { name: 'Maria Santos', photo_url: null } },
    ],
  },
  {
    id: 'ann2',
    title: 'Road Maintenance — April Update',
    body: 'The access road grading has been completed. Thanks to everyone who contributed to the road fund this year.\n\nNext project: dock repair. Details to follow.',
    author_id: 'demo-owner-2',
    pinned: false,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    owners: { name: 'Maria Santos', photo_url: null },
    comments: [],
  },
];

const DEMO_LISTINGS = [
  { id: 'l1', lot_number: 103, status: 'not_available', description: 'My primary jungle retreat.', price: '', existing_structures: '', external_sale_url: '', photos: [] },
  { id: 'l2', lot_number: 207, status: 'for_sale',      description: 'Elevated platform with ocean views.', price: '$150,000', existing_structures: '', external_sale_url: '', photos: [] },
];

// Cached lots.json for acreage lookup in the listing form
let lotsData = null;
fetch('../data/lots.json')
  .then(function (r) { return r.json(); })
  .then(function (d) { lotsData = d; })
  .catch(function () { lotsData = { lots: [] }; });

// =====================================================
// AUTH
// =====================================================

async function initAuth() {
  if (DEMO_MODE) {
    currentUser = { id: 'demo-user-1', email: 'demo@fincabuenavidapanama.com' };
    currentOwner = DEMO_OWNER;
    setSidebarMember(currentOwner);
    if (currentOwner.is_admin) showAdminElements();
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    showTab(hash);
    return;
  }

  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData || !sessionData.session) {
    window.location.replace('/member/login.html');
    return;
  }

  currentUser = sessionData.session.user;

  // Load owner profile
  const { data: ownerData, error: ownerError } = await sb
    .from('owners')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();

  if (ownerError || !ownerData) {
    // Owner record not yet created — show a placeholder and let admin set up
    currentOwner = {
      id: null,
      user_id: currentUser.id,
      name: currentUser.email,
      email: currentUser.email,
      lot_numbers: [],
      is_admin: false,
      directory_opt_in: false,
      created_at: new Date().toISOString(),
    };
  } else {
    currentOwner = ownerData;
  }

  setSidebarMember(currentOwner);
  if (currentOwner.is_admin) showAdminElements();

  const hash = window.location.hash.replace('#', '') || 'dashboard';
  showTab(hash);
}

function setSidebarMember(owner) {
  const nameEl = document.getElementById('sidebar-name');
  const lotsEl = document.getElementById('sidebar-lots');
  const avatarEl = document.getElementById('sidebar-avatar');

  if (nameEl) nameEl.textContent = owner.name || owner.email || 'Member';
  if (lotsEl) {
    const lots = (owner.lot_numbers || []);
    lotsEl.textContent = lots.length > 0
      ? 'Lot' + (lots.length > 1 ? 's' : '') + ' ' + lots.map(lotLabel).join(', ')
      : 'No lots assigned';
  }
  if (avatarEl) {
    avatarEl.textContent = initials(owner.name || owner.email || '?');
  }
}

function showAdminElements() {
  document.querySelectorAll('.admin-only').forEach(function (el) {
    el.style.display = '';
  });
}

// =====================================================
// TAB NAVIGATION
// =====================================================

function showTab(tab) {
  const validTabs = ['dashboard', 'dues', 'directory', 'documents', 'board', 'listing'];
  if (!validTabs.includes(tab)) tab = 'dashboard';

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(function (btn) {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Toggle tab panels
  document.querySelectorAll('.tab-content').forEach(function (panel) {
    panel.classList.remove('active');
  });
  const panel = document.getElementById('tab-' + tab);
  if (panel) panel.classList.add('active');

  // Update URL hash
  history.replaceState(null, '', '#' + tab);

  // Load tab content
  switch (tab) {
    case 'dashboard':  loadDashboard();  break;
    case 'dues':       loadDues();       break;
    case 'directory':  loadDirectory();  break;
    case 'documents':  loadDocuments();  break;
    case 'board':      loadBoard();      break;
    case 'listing':    loadMyListing();  break;
  }
}

// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {
  const panel = document.getElementById('tab-dashboard');
  panel.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  let duesStatus = null;
  let recentPosts = [];

  if (DEMO_MODE) {
    const myDues = DEMO_DUES.filter(function (d) { return d.owner_id === currentOwner.id; });
    const currentYear = new Date().getFullYear();
    const thisYearDue = myDues.find(function (d) { return d.year === currentYear; });
    duesStatus = thisYearDue || null;
    recentPosts = DEMO_ANNOUNCEMENTS.slice(0, 3);
  } else {
    const currentYear = new Date().getFullYear();
    const [duesRes, postsRes] = await Promise.all([
      sb.from('dues')
        .select('*')
        .eq('owner_id', currentOwner.id)
        .eq('year', currentYear)
        .maybeSingle(),
      sb.from('announcements')
        .select('id, title, pinned, created_at, owners(name)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3),
    ]);
    duesStatus = duesRes.data;
    recentPosts = postsRes.data || [];
  }

  const currentYear = new Date().getFullYear();
  const lots = currentOwner.lot_numbers || [];
  const memberSince = currentOwner.member_since || new Date(currentOwner.created_at).getFullYear();

  let duesStatusBadge = '';
  let duesAccent = 'accent-amber';
  if (!duesStatus) {
    duesStatusBadge = '<span class="badge due">No invoice</span>';
    duesAccent = 'accent-amber';
  } else if (duesStatus.paid_at) {
    duesStatusBadge = '<span class="badge paid">Paid ' + currentYear + '</span>';
    duesAccent = 'accent-green';
  } else {
    const isOverdue = new Date(duesStatus.due_date) < new Date();
    duesStatusBadge = isOverdue
      ? '<span class="badge overdue">Overdue</span>'
      : '<span class="badge due">Due ' + formatDate(duesStatus.due_date) + '</span>';
    duesAccent = isOverdue ? 'accent-coral' : 'accent-amber';
  }

  const recentPostsHtml = recentPosts.length === 0
    ? '<p class="empty-state">No announcements yet.</p>'
    : recentPosts.map(function (post) {
        return '<div class="recent-post-card" onclick="showTab(\'board\')">'
          + (post.pinned ? '<span class="badge pinned" style="margin-bottom:0.35rem;display:inline-flex;">📌 Pinned</span><br>' : '')
          + '<div class="recent-post-title">' + escHtml(post.title) + '</div>'
          + '<div class="recent-post-meta">'
          + (post.owners ? escHtml(post.owners.name) + ' · ' : '')
          + timeAgo(post.created_at)
          + '</div>'
          + '</div>';
      }).join('');

  const demoNotice = DEMO_MODE
    ? '<div class="login-success" style="margin-bottom:1.5rem;border-radius:0.6rem;">'
      + '<strong>Demo mode:</strong> Configure <code>member/config.js</code> with your Supabase credentials to connect real data.'
      + '</div>'
    : '';

  panel.innerHTML = demoNotice
    + '<div class="welcome-banner">'
    + '<span class="welcome-greeting">Welcome back,</span>'
    + '<div class="welcome-title">' + escHtml(currentOwner.name || 'Member') + '</div>'
    + '<div class="welcome-meta">Finca Buena Vida · Dolphin Bay, Panama</div>'
    + '</div>'

    + '<div class="stat-cards">'
    + '<div class="stat-card accent-teal">'
    + '<span class="stat-label">Your Lot(s)</span>'
    + '<div class="stat-value">' + (lots.length > 0 ? lots.map(lotLabel).join(', ') : '—') + '</div>'
    + '<div class="stat-sub">Property Owner</div>'
    + '</div>'

    + '<div class="stat-card ' + duesAccent + '">'
    + '<span class="stat-label">' + currentYear + ' Dues</span>'
    + '<div class="stat-value">'
    + (duesStatus ? formatCurrency(duesStatus.amount_cents) : '—')
    + '</div>'
    + '<div class="stat-sub">' + duesStatusBadge + '</div>'
    + '</div>'

    + '<div class="stat-card accent-green">'
    + '<span class="stat-label">Year Purchased</span>'
    + '<div class="stat-value">' + memberSince + '</div>'
    + '<div class="stat-sub">Community Member</div>'
    + '</div>'
    + '</div>'

    + '<h2 class="dashboard-section-title">Recent Announcements</h2>'
    + recentPostsHtml;
}

// =====================================================
// DUES
// =====================================================

async function loadDues() {
  const panel = document.getElementById('tab-dues');
  panel.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  let rows = [];

  if (DEMO_MODE) {
    rows = currentOwner.is_admin ? DEMO_DUES : DEMO_DUES.filter(function (d) { return d.owner_id === currentOwner.id; });
  } else {
    let query = sb.from('dues')
      .select('*, owners(name, email)')
      .order('year', { ascending: false });

    if (!currentOwner.is_admin) {
      query = query.eq('owner_id', currentOwner.id);
    }

    const { data, error } = await query;
    if (error) {
      panel.innerHTML = '<div class="empty-state">Error loading dues: ' + escHtml(error.message) + '</div>';
      return;
    }
    rows = data || [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const adminAddBtn = currentOwner.is_admin
    ? '<button class="btn-primary admin-only" onclick="openAddDueModal()">+ Add Invoice</button>'
    : '';

  let tableRows = '';
  rows.forEach(function (due) {
    const isPaid = !!due.paid_at;
    const dueDate = new Date(due.due_date);
    const isOverdue = !isPaid && dueDate < today;

    let statusBadge = '';
    if (isPaid) {
      statusBadge = '<span class="badge paid">Paid ' + formatDate(due.paid_at) + '</span>';
    } else if (isOverdue) {
      statusBadge = '<span class="badge overdue">Overdue</span>';
    } else {
      statusBadge = '<span class="badge due">Due ' + formatDate(due.due_date) + '</span>';
    }

    let actions = '';
    if (!isPaid) {
      actions += '<button class="btn-ghost btn-sm" onclick="openPaymentModal(\'' + due.id + '\',' + due.amount_cents + ',\'' + escHtml(due.owners ? due.owners.email : currentOwner.email) + '\')">Pay Now</button> ';
    }
    if (currentOwner.is_admin && !isPaid) {
      actions += '<button class="btn-ghost btn-sm admin-only" onclick="markPaid(\'' + due.id + '\')">Mark Paid</button>';
    }

    const ownerCell = currentOwner.is_admin
      ? '<td>' + escHtml(due.owners ? due.owners.name : '—') + '</td>'
      : '';

    tableRows += '<tr class="' + (isOverdue ? 'overdue-row' : '') + '">'
      + ownerCell
      + '<td>' + due.year + '</td>'
      + '<td>' + formatCurrency(due.amount_cents) + '</td>'
      + '<td>' + formatDate(due.due_date) + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td><div class="table-actions">' + actions + '</div></td>'
      + '</tr>';
  });

  const ownerHeader = currentOwner.is_admin ? '<th>Owner</th>' : '';

  const emptyRow = rows.length === 0
    ? '<tr><td colspan="6" class="empty-state">No dues records found.</td></tr>'
    : '';

  panel.innerHTML = '<div class="page-header">'
    + '<h1 class="page-title">Dues</h1>'
    + '<div class="section-actions">'
    + adminAddBtn
    + '</div>'
    + '</div>'

    + '<div class="table-wrap">'
    + '<table class="data-table">'
    + '<thead><tr>'
    + ownerHeader
    + '<th>Year</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th>'
    + '</tr></thead>'
    + '<tbody>'
    + (rows.length > 0 ? tableRows : emptyRow)
    + '</tbody>'
    + '</table>'
    + '</div>'

    + '<div class="payment-instructions">'
    + '<h3>Payment Options</h3>'
    + '<p>Credit card payments include a <strong>2.9% + $0.30</strong> processing fee passed through to the payer.</p>'
    + '<p style="margin-top:0.6rem;">To pay without a processing fee, use one of these methods:</p>'
    + '<ul>'
    + '<li><strong>Wire transfer:</strong> Contact the board for wire instructions.</li>'
    + '<li><strong>Check:</strong> Mail to the HOA treasurer. Contact board for address.</li>'
    + '</ul>'
    + '<p style="margin-top:0.6rem;">After paying by wire or check, the board will update your payment status. Questions? Email the board.</p>'
    + '</div>';

  // Re-apply admin visibility if admin
  if (currentOwner.is_admin) showAdminElements();

  // (payment-form onsubmit wired at bottom of file)
}

// =====================================================
// PAYMENT MODAL
// =====================================================

function openPaymentModal(dueId, amountCents, ownerEmail) {
  const feeCents = Math.round(amountCents * 0.029 + 30);
  const totalCents = amountCents + feeCents;

  document.getElementById('pay-due-id').value = dueId;
  document.getElementById('pay-amount-cents').value = amountCents;
  document.getElementById('pay-owner-email').value = ownerEmail;
  document.getElementById('pay-base-amount').textContent = formatCurrency(amountCents);
  document.getElementById('pay-fee-amount').textContent = formatCurrency(feeCents);
  document.getElementById('pay-total-amount').textContent = formatCurrency(totalCents);
  document.getElementById('payment-error').hidden = true;
  document.getElementById('pay-submit').disabled = false;
  document.getElementById('pay-submit').textContent = 'Pay Now';

  // Mount Stripe card element
  if (stripe) {
    const elements = stripe.elements();
    if (cardElement) {
      cardElement.destroy();
    }
    cardElement = elements.create('card', {
      style: {
        base: {
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: '15px',
          color: '#1c2b20',
          '::placeholder': { color: '#6b7f6e' },
        },
        invalid: { color: '#b91c1c' },
      },
    });
    cardElement.mount('#card-element');
  } else {
    document.getElementById('card-element').innerHTML =
      '<p style="font-family:var(--font-sans);font-size:0.85rem;color:var(--text-light);">'
      + 'Stripe not configured. Add your Stripe publishable key to member/config.js.</p>';
  }

  openModal('payment-modal');
}

async function submitPayment(e) {
  e.preventDefault();

  if (!stripe || !cardElement) {
    showToast('Payment system not configured.', 'error');
    return;
  }

  const dueId = document.getElementById('pay-due-id').value;
  const amountCents = parseInt(document.getElementById('pay-amount-cents').value, 10);
  const ownerEmail = document.getElementById('pay-owner-email').value;
  const errEl = document.getElementById('payment-error');
  const btn = document.getElementById('pay-submit');

  errEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Processing…';

  try {
    const res = await fetch('/.netlify/functions/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueId, amountCents, ownerEmail, passthrough: true }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Payment server error');

    const { clientSecret } = json;
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (stripeError) {
      errEl.textContent = stripeError.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Pay Now';
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      closeAllModals();
      showToast('Payment successful! Your dues have been recorded.', 'success');
      setTimeout(loadDues, 1500);
    }
  } catch (err) {
    errEl.textContent = err.message || 'Payment failed. Please try again.';
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Pay Now';
  }
}

async function markPaid(dueId) {
  if (!confirm('Mark this dues invoice as paid (wire/check/other)?')) return;

  if (DEMO_MODE) {
    showToast('Demo mode: would mark due ' + dueId + ' as paid.', 'info');
    return;
  }

  const { error } = await sb.from('dues').update({
    paid_at: new Date().toISOString(),
    payment_method: 'other',
  }).eq('id', dueId);

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }
  showToast('Dues marked as paid.', 'success');
  loadDues();
}

// =====================================================
// ADD DUE MODAL (admin)
// =====================================================

function openAddDueModal() {
  document.getElementById('due-owner-email').value = '';
  document.getElementById('due-year').value = new Date().getFullYear();
  document.getElementById('due-amount').value = '';
  document.getElementById('due-date').value = '';
  document.getElementById('add-due-error').hidden = true;
  document.getElementById('add-due-submit').disabled = false;
  document.getElementById('add-due-submit').textContent = 'Create Invoice';
  openModal('add-due-modal');
}

async function submitAddDue(e) {
  e.preventDefault();

  const email = document.getElementById('due-owner-email').value.trim();
  const year = parseInt(document.getElementById('due-year').value, 10);
  const amountDollars = parseFloat(document.getElementById('due-amount').value);
  const dueDate = document.getElementById('due-date').value;
  const errEl = document.getElementById('add-due-error');
  const btn = document.getElementById('add-due-submit');

  errEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Creating…';

  if (DEMO_MODE) {
    showToast('Demo mode: would create invoice for ' + email + ' (' + year + ').', 'info');
    closeAllModals();
    btn.disabled = false;
    btn.textContent = 'Create Invoice';
    return;
  }

  // Look up owner by email
  const { data: owner, error: ownerErr } = await sb
    .from('owners')
    .select('id')
    .eq('email', email)
    .single();

  if (ownerErr || !owner) {
    errEl.textContent = 'No owner account found with that email address.';
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Create Invoice';
    return;
  }

  const amountCents = Math.round(amountDollars * 100);

  const { error: insertErr } = await sb.from('dues').insert({
    owner_id: owner.id,
    year,
    amount_cents: amountCents,
    due_date: dueDate,
  });

  if (insertErr) {
    errEl.textContent = insertErr.message;
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Create Invoice';
    return;
  }

  closeAllModals();
  showToast('Invoice created for ' + email + ' (' + year + ').', 'success');
  loadDues();
}

// =====================================================
// DIRECTORY
// =====================================================

async function loadDirectory() {
  const panel = document.getElementById('tab-directory');
  panel.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  let members = [];

  if (DEMO_MODE) {
    members = DEMO_DIRECTORY;
  } else {
    const { data, error } = await sb
      .from('owners')
      .select('id, name, email, lot_numbers, bio, directory_opt_in, origin, property_goals, months_ideal, months_actual, fbv_pics_url, member_since')
      .eq('directory_opt_in', true)
      .order('name');

    if (error) {
      panel.innerHTML = '<div class="empty-state">Error loading directory: ' + escHtml(error.message) + '</div>';
      return;
    }
    members = data || [];
  }

  const isOptedIn = currentOwner.directory_opt_in;

  const profileEditHtml = isOptedIn ? renderProfileEditForm() : '';

  const memberCards = members.map(function (m) {
    return '<div class="directory-card">'
      + '<div class="dir-avatar">' + escHtml(initials(m.name)) + '</div>'
      + '<div class="dir-name">' + escHtml(m.name) + '</div>'
      + '<div class="dir-lot">'
      + ((m.lot_numbers || []).length > 0
          ? 'Lot' + (m.lot_numbers.length > 1 ? 's' : '') + ' ' + m.lot_numbers.map(lotLabel).join(', ')
          : 'Property Owner')
      + '</div>'
      + (m.bio ? '<div class="dir-bio">' + escHtml(m.bio) + '</div>' : '')
      + (m.member_since ? '<div class="dir-meta"><span class="dir-meta-label">Year Purchased</span> ' + escHtml(String(m.member_since)) + '</div>' : '')
      + (m.origin ? '<div class="dir-meta"><span class="dir-meta-label">Originally from</span> ' + escHtml(m.origin) + '</div>' : '')
      + (m.property_goals ? '<div class="dir-meta"><span class="dir-meta-label">Goals for FBV Property</span> ' + escHtml(m.property_goals) + '</div>' : '')
      + ((m.months_ideal != null || m.months_actual != null) ? '<div class="dir-meta"><span class="dir-meta-label">Months/year @ FBV</span> '
          + (m.months_ideal != null ? m.months_ideal + ' ideal' : '')
          + (m.months_ideal != null && m.months_actual != null ? ' · ' : '')
          + (m.months_actual != null ? m.months_actual + ' actual' : '')
          + '</div>' : '')
      + (m.fbv_pics_url ? '<a href="' + escHtml(m.fbv_pics_url) + '" class="dir-pics-link" target="_blank" rel="noopener">📷 My FBV Pics</a>' : '')
      + '<a href="mailto:' + escHtml(m.email) + '" class="dir-email">' + escHtml(m.email) + '</a>'
      + '</div>';
  }).join('');

  panel.innerHTML = '<div class="page-header">'
    + '<h1 class="page-title">Member Directory</h1>'
    + '</div>'

    + '<div class="directory-controls">'
    + '<div class="directory-optin-group">'
    + '<span class="optin-label">Show my profile in directory</span>'
    + '<label class="toggle-label">'
    + '<span class="toggle-track' + (isOptedIn ? ' is-checked' : '') + '">'
    + '<input type="checkbox" id="optin-toggle" ' + (isOptedIn ? 'checked' : '') + ' onchange="toggleDirectoryOptIn(this.checked)" />'
    + '<span class="toggle-thumb"></span>'
    + '</span>'
    + '</label>'
    + '</div>'
    + '<span style="font-family:var(--font-sans);font-size:0.8rem;color:var(--text-light);">'
    + members.length + ' member' + (members.length !== 1 ? 's' : '') + ' listed'
    + '</span>'
    + '</div>'

    + profileEditHtml

    + '<div class="directory-grid">'
    + (members.length > 0 ? memberCards : '<p class="empty-state">No members have opted in to the directory yet.</p>')
    + '</div>';

  // Wire up profile form if rendered
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = saveProfile;
  }
}

function renderProfileEditForm() {
  const o = currentOwner;
  return '<div class="profile-edit">'
    + '<div class="profile-edit-title">Your Directory Profile</div>'
    + '<form id="profile-form" novalidate>'
    + '<div class="form-row">'
    + '<div class="form-field"><label for="profile-name">Name</label>'
    + '<input type="text" id="profile-name" value="' + escHtml(o.name || '') + '" required /></div>'
    + '<div class="form-field"><label for="profile-phone">Phone</label>'
    + '<input type="text" id="profile-phone" value="' + escHtml(o.phone || '') + '" /></div>'
    + '</div>'
    + '<div class="form-field"><label for="profile-bio">Bio</label>'
    + '<textarea id="profile-bio" rows="2" maxlength="500" placeholder="A little about yourself…">' + escHtml(o.bio || '') + '</textarea>'
    + '<span style="font-size:0.75rem;color:var(--text-light)">Max 500 characters</span></div>'
    + '<div class="form-field"><label for="profile-pics">My FBV Pics</label>'
    + '<input type="text" id="profile-pics" value="' + escHtml(o.fbv_pics_url || '') + '" placeholder="https://photos.app.goo.gl/…" />'
    + '<span style="font-size:0.75rem;color:var(--text-light);font-style:italic">Link to a shared Google Photos album, Dropbox folder, or any public photo gallery.</span></div>'
    + '<div class="form-field"><label for="profile-member-since">Year Purchased</label>'
    + '<input type="number" id="profile-member-since" value="' + (o.member_since || '') + '" min="1990" max="2099" placeholder="e.g. 2009" /></div>'
    + '<div class="form-field"><label for="profile-origin">Where are you originally from?</label>'
    + '<input type="text" id="profile-origin" value="' + escHtml(o.origin || '') + '" placeholder="e.g. Portland, Oregon" /></div>'
    + '<div class="form-field"><label for="profile-goals">Goals for your FBV property?</label>'
    + '<textarea id="profile-goals" rows="2" placeholder="e.g. Build a family retreat, eventually retire here…">' + escHtml(o.property_goals || '') + '</textarea></div>'
    + '<div class="form-row">'
    + '<div class="form-field"><label for="profile-months-ideal">Months per year @ FBV — ideal</label>'
    + '<input type="number" id="profile-months-ideal" value="' + (o.months_ideal != null ? o.months_ideal : '') + '" min="0" max="12" placeholder="0–12" /></div>'
    + '<div class="form-field"><label for="profile-months-actual">Months per year @ FBV — actual</label>'
    + '<input type="number" id="profile-months-actual" value="' + (o.months_actual != null ? o.months_actual : '') + '" min="0" max="12" placeholder="0–12" /></div>'
    + '</div>'
    + '<button type="submit" class="btn-primary btn-sm">Save Profile</button>'
    + '</form>'
    + '</div>';
}

async function toggleDirectoryOptIn(value) {
  if (DEMO_MODE) {
    currentOwner.directory_opt_in = value;
    showToast(value ? 'Added to directory.' : 'Removed from directory.', 'success');
    loadDirectory();
    return;
  }

  const { error } = await sb.from('owners')
    .update({ directory_opt_in: value })
    .eq('id', currentOwner.id);

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }
  currentOwner.directory_opt_in = value;
  showToast(value ? 'Added to directory.' : 'Removed from directory.', 'success');
  loadDirectory();
}

async function saveProfile(e) {
  e.preventDefault();

  const name           = document.getElementById('profile-name').value.trim();
  const phone          = document.getElementById('profile-phone').value.trim();
  const bio            = document.getElementById('profile-bio').value.trim();
  const fbv_pics_url   = document.getElementById('profile-pics').value.trim();
  const member_since   = document.getElementById('profile-member-since').value !== '' ? parseInt(document.getElementById('profile-member-since').value, 10) : null;
  const origin         = document.getElementById('profile-origin').value.trim();
  const property_goals = document.getElementById('profile-goals').value.trim();
  const months_ideal   = document.getElementById('profile-months-ideal').value !== '' ? parseInt(document.getElementById('profile-months-ideal').value, 10) : null;
  const months_actual  = document.getElementById('profile-months-actual').value !== '' ? parseInt(document.getElementById('profile-months-actual').value, 10) : null;
  const btn = e.target.querySelector('[type="submit"]');

  btn.disabled = true;
  btn.textContent = 'Saving…';

  if (DEMO_MODE) {
    currentOwner.name = name;
    currentOwner.phone = phone;
    currentOwner.bio = bio;
    currentOwner.fbv_pics_url = fbv_pics_url;
    setSidebarMember(currentOwner);
    showToast('Profile updated.', 'success');
    btn.disabled = false;
    btn.textContent = 'Save Profile';
    loadDirectory();
    return;
  }

  const { error } = await sb.from('owners').update({ name, phone, bio, fbv_pics_url, member_since, origin, property_goals, months_ideal, months_actual }).eq('id', currentOwner.id);

  if (error) {
    showToast('Error: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save Profile';
    return;
  }

  currentOwner.name = name;
  currentOwner.phone = phone;
  currentOwner.bio = bio;
  currentOwner.fbv_pics_url = fbv_pics_url;
  currentOwner.member_since = member_since;
  currentOwner.origin = origin;
  currentOwner.property_goals = property_goals;
  currentOwner.months_ideal = months_ideal;
  currentOwner.months_actual = months_actual;
  setSidebarMember(currentOwner);
  showToast('Profile updated.', 'success');
  btn.disabled = false;
  btn.textContent = 'Save Profile';
  loadDirectory();
}

// =====================================================
// DOCUMENTS
// =====================================================

async function loadDocuments() {
  const panel = document.getElementById('tab-documents');
  panel.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  let docs = [];

  if (DEMO_MODE) {
    docs = DEMO_DOCUMENTS;
  } else {
    const { data, error } = await sb
      .from('documents')
      .select('*')
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      panel.innerHTML = '<div class="empty-state">Error loading documents: ' + escHtml(error.message) + '</div>';
      return;
    }
    docs = data || [];
  }

  // Group by category
  const categories = ['minutes', 'covenants', 'financial', 'legal', 'other'];
  const categoryLabels = {
    minutes: 'Meeting Minutes',
    covenants: 'Covenants & Rules',
    financial: 'Financial Reports',
    legal: 'Legal Documents',
    other: 'Other',
  };

  const grouped = {};
  categories.forEach(function (cat) { grouped[cat] = []; });
  docs.forEach(function (doc) {
    if (grouped[doc.category]) grouped[doc.category].push(doc);
  });

  const uploadBtn = '<button class="btn-primary" onclick="openUploadModal()">+ Upload Document</button>';

  let sectionsHtml = '';
  categories.forEach(function (cat) {
    const catDocs = grouped[cat];
    if (catDocs.length === 0) return;

    const docRowsHtml = catDocs.map(function (doc) {
      const canDelete = currentOwner.is_admin || doc.uploaded_by === currentOwner.id;
      const deleteBtn = canDelete
        ? '<button class="btn-ghost btn-sm danger" onclick="deleteDocument(\'' + doc.id + '\',\'' + escHtml(doc.storage_path || '') + '\')">Delete</button>'
        : '';

      const downloadBtn = doc.reference_only
        ? ''
        : '<a href="' + escHtml(doc.file_url) + '" target="_blank" rel="noopener" class="btn-ghost btn-sm">Download</a>';

      return '<div class="doc-row">'
        + '<span class="doc-icon">' + docIcon(doc.category) + '</span>'
        + '<div class="doc-info">'
        + '<div class="doc-title">' + escHtml(doc.title) + '</div>'
        + '<div class="doc-meta">'
        + categoryLabels[doc.category]
        + (doc.year ? ' · ' + doc.year : '')
        + ' · ' + formatDate(doc.created_at)
        + '</div>'
        + (doc.reference_only
            ? '<div class="doc-ref-note">' + (doc.reference_note ? escHtml(doc.reference_note) : 'Reference only') + '</div>'
            : '')
        + '</div>'
        + '<div class="doc-actions">'
        + (doc.reference_only ? '<span class="badge ref-only">Reference Only</span>' : downloadBtn)
        + deleteBtn
        + '</div>'
        + '</div>';
    }).join('');

    sectionsHtml += '<div class="doc-category-section">'
      + '<div class="doc-category-title">' + categoryLabels[cat] + '</div>'
      + '<div class="doc-list">' + docRowsHtml + '</div>'
      + '</div>';
  });

  if (!sectionsHtml) {
    sectionsHtml = '<p class="empty-state"><span class="empty-icon">📄</span>No documents have been uploaded yet.</p>';
  }

  panel.innerHTML = '<div class="page-header">'
    + '<h1 class="page-title">Documents</h1>'
    + '<div class="section-actions">' + uploadBtn + '</div>'
    + '</div>'
    + '<p style="font-size:0.78rem;color:var(--text-light);font-style:italic;margin:-0.5rem 0 1.5rem">'
    + 'All documents are visible to every verified portal member. Please keep uploads under 5 MB to help manage hosting costs.'
    + '</p>'
    + sectionsHtml;

  if (currentOwner.is_admin) showAdminElements();

  // Wire upload form
  document.getElementById('upload-form').onsubmit = submitUpload;

  // Toggle reference note field
  const refOnlyCheck = document.getElementById('upload-ref-only');
  if (refOnlyCheck) {
    refOnlyCheck.onchange = function () {
      document.getElementById('upload-ref-note-field').hidden = !this.checked;
      document.getElementById('upload-file-field').hidden = this.checked;
    };
  }
}

function openUploadModal() {
  document.getElementById('upload-form').reset();
  document.getElementById('upload-ref-note-field').hidden = true;
  document.getElementById('upload-file-field').hidden = false;
  document.getElementById('upload-error').hidden = true;
  document.getElementById('upload-submit').disabled = false;
  document.getElementById('upload-submit').textContent = 'Upload Document';
  openModal('upload-modal');
}

async function submitUpload(e) {
  e.preventDefault();

  const title = document.getElementById('upload-title').value.trim();
  const category = document.getElementById('upload-category').value;
  const year = document.getElementById('upload-year').value ? parseInt(document.getElementById('upload-year').value, 10) : null;
  const refOnly = document.getElementById('upload-ref-only').checked;
  const refNote = document.getElementById('upload-ref-note').value.trim();
  const fileInput = document.getElementById('upload-file');
  const errEl = document.getElementById('upload-error');
  const btn = document.getElementById('upload-submit');

  errEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Uploading…';

  if (!title || !category) {
    errEl.textContent = 'Please fill in title and category.';
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Upload Document';
    return;
  }

  if (DEMO_MODE) {
    showToast('Demo mode: document upload not available without Supabase.', 'info');
    closeAllModals();
    btn.disabled = false;
    btn.textContent = 'Upload Document';
    return;
  }

  let file_url = '';
  let storage_path = null;

  if (!refOnly) {
    const file = fileInput.files[0];
    if (!file) {
      errEl.textContent = 'Please select a file to upload.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Upload Document';
      return;
    }

    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_BYTES) {
      errEl.textContent = 'File too large — maximum size is 5 MB.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Upload Document';
      return;
    }

    const ext = file.name.split('.').pop();
    const fileName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = category + '/' + fileName;

    const { error: storageErr } = await sb.storage
      .from('documents')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (storageErr) {
      errEl.textContent = 'Upload failed: ' + storageErr.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Upload Document';
      return;
    }

    const { data: urlData } = sb.storage.from('documents').getPublicUrl(path);
    file_url = urlData.publicUrl;
    storage_path = path;
  } else {
    file_url = '#ref-only';
  }

  const { error: dbErr } = await sb.from('documents').insert({
    title,
    category,
    year,
    file_url,
    storage_path,
    reference_only: refOnly,
    reference_note: refOnly ? refNote : null,
    uploaded_by: currentOwner.id,
  });

  if (dbErr) {
    errEl.textContent = dbErr.message;
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Upload Document';
    return;
  }

  closeAllModals();
  showToast('Document uploaded successfully.', 'success');
  loadDocuments();
}

async function deleteDocument(docId, storagePath) {
  if (!confirm('Delete this document? This cannot be undone.')) return;

  if (DEMO_MODE) {
    showToast('Demo mode: would delete document ' + docId + '.', 'info');
    return;
  }

  if (storagePath) {
    await sb.storage.from('documents').remove([storagePath]);
  }

  const { error } = await sb.from('documents').delete().eq('id', docId);
  if (error) {
    showToast('Error deleting document: ' + error.message, 'error');
    return;
  }
  showToast('Document deleted.', 'success');
  loadDocuments();
}

// =====================================================
// BOARD
// =====================================================

async function loadBoard() {
  const panel = document.getElementById('tab-board');
  panel.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  let posts = [];

  if (DEMO_MODE) {
    posts = DEMO_ANNOUNCEMENTS;
  } else {
    const { data, error } = await sb
      .from('announcements')
      .select('*, owners(name, photo_url), comments(*, owners(name, photo_url))')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      panel.innerHTML = '<div class="empty-state">Error loading board: ' + escHtml(error.message) + '</div>';
      return;
    }
    posts = data || [];
  }

  const newPostBtn = currentOwner.is_admin
    ? '<button class="btn-primary admin-only" onclick="openPostModal()">+ New Post</button>'
    : '';

  // Store posts by id so openEditPostModal can look them up safely
  window._boardPosts = {};
  posts.forEach(function (p) { window._boardPosts[p.id] = p; });

  const postsHtml = posts.map(function (post) {
    const authorName = post.owners ? escHtml(post.owners.name) : 'Board';
    const authorPhoto = post.owners && post.owners.photo_url;
    const avatarHtml = authorPhoto
      ? '<img src="' + escHtml(authorPhoto) + '" alt="' + authorName + '" />'
      : escHtml(initials(post.owners ? post.owners.name : 'Board'));

    const pinnedBadge = post.pinned
      ? '<span class="badge pinned">📌 Pinned</span>'
      : '';

    const adminBtns = currentOwner.is_admin
      ? '<div class="post-actions-top admin-only">'
        + '<button class="btn-ghost btn-sm" onclick="togglePin(\'' + post.id + '\',' + (post.pinned ? 'false' : 'true') + ')">'
        + (post.pinned ? 'Unpin' : 'Pin') + '</button>'
        + '<button class="btn-ghost btn-sm" onclick="openEditPostModal(\'' + post.id + '\')">Edit</button>'
        + '<button class="btn-ghost btn-sm danger" onclick="deletePost(\'' + post.id + '\')">Delete</button>'
        + '</div>'
      : '';

    const comments = (post.comments || [])
      .slice()
      .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });

    const commentsHtml = comments.length > 0
      ? comments.map(function (c) {
          const cName = c.owners ? c.owners.name : 'Member';
          const cPhoto = c.owners && c.owners.photo_url;
          const cAvatar = cPhoto
            ? '<img src="' + escHtml(cPhoto) + '" alt="' + escHtml(cName) + '" />'
            : escHtml(initials(cName));
          return '<div class="comment-item">'
            + '<div class="comment-avatar">' + cAvatar + '</div>'
            + '<div class="comment-content">'
            + '<span class="comment-author">' + escHtml(cName) + '</span>'
            + '<span class="comment-time">' + timeAgo(c.created_at) + '</span>'
            + '<div class="comment-body">' + escHtml(c.body) + '</div>'
            + '</div>'
            + '</div>';
        }).join('')
      : '';

    return '<div class="post-card' + (post.pinned ? ' pinned-card' : '') + '" id="post-' + post.id + '">'
      + '<div class="post-header">'
      + '<div class="post-author-avatar">' + avatarHtml + '</div>'
      + '<div class="post-meta-group">'
      + '<div class="post-title">' + escHtml(post.title) + ' ' + pinnedBadge + '</div>'
      + '<div class="post-byline">'
      + authorName + ' · ' + timeAgo(post.created_at)
      + '</div>'
      + '</div>'
      + adminBtns
      + '</div>'
      + '<div class="post-body">' + markdownLite(post.body) + '</div>'
      + '<div class="comments-section">'
      + (comments.length > 0 ? '<div class="comments-title">' + comments.length + ' comment' + (comments.length !== 1 ? 's' : '') + '</div>' : '')
      + '<div class="comment-thread">' + commentsHtml + '</div>'
      + '<form class="comment-form" onsubmit="postComment(event,\'' + post.id + '\')">'
      + '<textarea class="comment-input" placeholder="Add a comment…" rows="1" required></textarea>'
      + '<button type="submit" class="comment-submit">Reply</button>'
      + '</form>'
      + '</div>'
      + '</div>';
  }).join('');

  panel.innerHTML = '<div class="page-header">'
    + '<h1 class="page-title">Announcements</h1>'
    + '<p style="font-size:0.78rem;color:var(--text-light);font-style:italic;margin:-0.5rem 0 1.5rem">Posting is currently limited to admins while we get the portal established.</p>'
    + '<div class="section-actions">' + newPostBtn + '</div>'
    + '</div>'
    + (posts.length > 0 ? postsHtml : '<p class="empty-state"><span class="empty-icon">💬</span>No announcements yet. Check back soon.</p>');

  if (currentOwner.is_admin) showAdminElements();

  // Wire post modal form
  document.getElementById('post-form').onsubmit = submitPost;
}

async function postComment(e, announcementId) {
  e.preventDefault();
  const form = e.target;
  const textarea = form.querySelector('.comment-input');
  const body = textarea.value.trim();
  if (!body) return;

  if (DEMO_MODE) {
    showToast('Demo mode: comments require Supabase.', 'info');
    return;
  }

  textarea.disabled = true;
  const submitBtn = form.querySelector('.comment-submit');
  submitBtn.disabled = true;

  const { error } = await sb.from('comments').insert({
    announcement_id: announcementId,
    author_id: currentOwner.id,
    body,
  });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    textarea.disabled = false;
    submitBtn.disabled = false;
    return;
  }

  textarea.value = '';
  textarea.disabled = false;
  submitBtn.disabled = false;
  loadBoard();
}

function openPostModal() {
  document.getElementById('post-form').reset();
  document.getElementById('post-edit-id').value = '';
  document.getElementById('post-modal-title').textContent = 'New Announcement';
  document.getElementById('post-submit').textContent = 'Post Announcement';
  document.getElementById('post-error').hidden = true;
  document.getElementById('post-submit').disabled = false;
  openModal('post-modal');
}

function openEditPostModal(id) {
  const post = window._boardPosts && window._boardPosts[id];
  if (!post) return;
  document.getElementById('post-edit-id').value = id;
  document.getElementById('post-modal-title').textContent = 'Edit Announcement';
  document.getElementById('post-title').value = post.title;
  document.getElementById('post-body').value = post.body;
  document.getElementById('post-pinned').checked = post.pinned;
  document.getElementById('post-error').hidden = true;
  document.getElementById('post-submit').disabled = false;
  document.getElementById('post-submit').textContent = 'Save Changes';
  openModal('post-modal');
}

async function submitPost(e) {
  e.preventDefault();
  const title   = document.getElementById('post-title').value.trim();
  const body    = document.getElementById('post-body').value.trim();
  const pinned  = document.getElementById('post-pinned').checked;
  const editId  = document.getElementById('post-edit-id').value;
  const errEl   = document.getElementById('post-error');
  const btn     = document.getElementById('post-submit');
  const isEdit  = !!editId;

  errEl.hidden = true;
  btn.disabled = true;
  btn.textContent = isEdit ? 'Saving…' : 'Posting…';

  if (DEMO_MODE) {
    showToast('Demo mode: requires Supabase.', 'info');
    closeAllModals();
    btn.disabled = false;
    btn.textContent = isEdit ? 'Save Changes' : 'Post Announcement';
    return;
  }

  let error;
  if (isEdit) {
    ({ error } = await sb.from('announcements').update({ title, body, pinned }).eq('id', editId));
  } else {
    ({ error } = await sb.from('announcements').insert({ title, body, pinned, author_id: currentOwner.id }));
  }

  if (error) {
    errEl.textContent = error.message;
    errEl.hidden = false;
    btn.disabled = false;
    btn.textContent = isEdit ? 'Save Changes' : 'Post Announcement';
    return;
  }

  closeAllModals();
  showToast(isEdit ? 'Announcement updated.' : 'Announcement posted.', 'success');
  loadBoard();
}

async function togglePin(postId, pinValue) {
  if (DEMO_MODE) {
    showToast('Demo mode: pin requires Supabase.', 'info');
    return;
  }
  const { error } = await sb.from('announcements').update({ pinned: pinValue }).eq('id', postId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(pinValue ? 'Post pinned.' : 'Post unpinned.', 'success');
  loadBoard();
}

async function deletePost(postId) {
  if (!confirm('Delete this announcement and all its comments?')) return;
  if (DEMO_MODE) {
    showToast('Demo mode: delete requires Supabase.', 'info');
    return;
  }
  const { error } = await sb.from('announcements').delete().eq('id', postId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Announcement deleted.', 'success');
  loadBoard();
}

// =====================================================
// MY LISTING
// =====================================================

async function loadMyListing() {
  const panel = document.getElementById('tab-listing');
  panel.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  const lots = currentOwner.lot_numbers || [];

  if (lots.length === 0) {
    panel.innerHTML = '<div class="page-header"><h1 class="page-title">My Lot(s)</h1></div>'
      + '<p class="empty-state"><span class="empty-icon">🏡</span>No lots are assigned to your account. Contact the board to update your profile.</p>';
    return;
  }

  let existingListings = {};

  if (DEMO_MODE) {
    DEMO_LISTINGS.forEach(function (l) { existingListings[l.lot_number] = l; });
  } else {
    const { data, error } = await sb.from('lot_listings')
      .select('*')
      .in('lot_number', lots);

    if (error) {
      panel.innerHTML = '<div class="empty-state">Error loading listings: ' + escHtml(error.message) + '</div>';
      return;
    }
    (data || []).forEach(function (l) { existingListings[l.lot_number] = l; });
  }

  const statusLabels = { 'not_available': 'Not Available', 'for_sale': 'For Sale', 'rental': 'Rental' };
  const reqStar = '<span style="color:var(--accent-coral,#d9644a);font-size:0.8em;margin-left:3px">*</span>';

  const sectionsHtml = lots.map(function (lotNum) {
    const listing = existingListings[lotNum] || {};
    const s = listing.status || 'not_available';
    const isForSale = s === 'for_sale';
    const isRental  = s === 'rental';
    const isActive  = isForSale || isRental;

    return '<div class="listing-section">'
      + '<div class="listing-lot-title">Lot ' + lotLabel(lotNum) + '</div>'
      + '<form id="listing-form-' + lotNum + '" onsubmit="saveListing(event,' + lotNum + ')" novalidate>'
      + '<div class="listing-form-grid">'

      // Status
      + '<div class="form-field"><label for="listing-status-' + lotNum + '">Status</label>'
      + '<select id="listing-status-' + lotNum + '" onchange="updateListingFormFields(' + lotNum + ')">'
      + ['not_available', 'for_sale', 'rental'].map(function (v) {
          return '<option value="' + v + '"' + (s === v ? ' selected' : '') + '>' + statusLabels[v] + '</option>';
        }).join('')
      + '</select></div>'

      // Acreage
      + '<div class="form-field"><label for="listing-acreage-' + lotNum + '">Acreage'
      + '<span id="listing-acreage-req-' + lotNum + '" style="color:var(--accent-coral,#d9644a);font-size:0.8em;margin-left:3px;' + (isForSale ? '' : 'display:none') + '"> *</span>'
      + '<span style="font-size:0.75rem;color:var(--text-light);font-weight:400;margin-left:6px">Required if For Sale</span></label>'
      + '<input type="text" id="listing-acreage-' + lotNum + '" value="' + escHtml(listing.acreage || '') + '" placeholder="e.g. 0.75" /></div>'

      // Email contact
      + '<div class="form-field"><label for="listing-email-' + lotNum + '">Contact Email'
      + '<span id="listing-email-req-' + lotNum + '" style="color:var(--accent-coral,#d9644a);font-size:0.8em;margin-left:3px;' + (isActive ? '' : 'display:none') + '"> *</span>'
      + '<span style="font-size:0.75rem;color:var(--text-light);font-weight:400;margin-left:6px">Required if For Sale or Rental</span></label>'
      + '<input type="email" id="listing-email-' + lotNum + '" value="' + escHtml(listing.email_contact || '') + '" placeholder="your@email.com" /></div>'

      // Description (full width)
      + '<div class="form-field listing-form-full"><label for="listing-desc-' + lotNum + '">Description'
      + '<span id="listing-desc-req-' + lotNum + '" style="color:var(--accent-coral,#d9644a);font-size:0.8em;margin-left:3px;' + (isActive ? '' : 'display:none') + '"> *</span>'
      + '<span style="font-size:0.75rem;color:var(--text-light);font-weight:400;margin-left:6px">Required if For Sale or Rental · max 500 characters</span></label>'
      + '<textarea id="listing-desc-' + lotNum + '" rows="3" maxlength="500" placeholder="Describe your lot. Tip: tailor your description to the status you have selected (for sale, rental, or general info).">' + escHtml(listing.description || '') + '</textarea></div>'

      // External URL (full width)
      + '<div class="form-field listing-form-full"><label for="listing-url-' + lotNum + '">External URL</label>'
      + '<input type="text" id="listing-url-' + lotNum + '" value="' + escHtml(listing.external_sale_url || '') + '" placeholder="https://…" />'
      + '<span style="font-size:0.75rem;color:var(--text-light);font-style:italic">Add an external link to sell, rent, or just showcase your property.</span></div>'

      // Asking Price (for_sale only)
      + '<div class="form-field" id="listing-price-wrap-' + lotNum + '"' + (isForSale ? '' : ' style="display:none"') + '>'
      + '<label for="listing-price-' + lotNum + '">Asking Price <span style="font-size:0.75rem;color:var(--text-light);font-weight:400">(optional — only shown if entered)</span></label>'
      + '<input type="text" id="listing-price-' + lotNum + '" value="' + escHtml(listing.price || '') + '" placeholder="e.g. $250,000" /></div>'

      // Availability Notes (rental only)
      + '<div class="form-field listing-form-full" id="listing-avail-wrap-' + lotNum + '"' + (isRental ? '' : ' style="display:none"') + '>'
      + '<label for="listing-avail-' + lotNum + '">Availability Notes <span style="font-size:0.75rem;color:var(--text-light);font-weight:400">(optional — only shown if entered · max 100 characters)</span></label>'
      + '<textarea id="listing-avail-' + lotNum + '" rows="2" maxlength="100" placeholder="e.g. Available June–August. Contact for weekly rates.">' + escHtml(listing.availability_notes || '') + '</textarea></div>'

      + '</div>'
      + '<button type="submit" class="btn-primary btn-sm" id="listing-save-' + lotNum + '">Save Listing</button>'
      + '</form>'
      + '</div>';
  }).join('');

  panel.innerHTML = '<div class="page-header"><h1 class="page-title">My Lot(s)</h1></div>'
    + '<p style="font-family:var(--font-sans);font-size:0.875rem;color:var(--text-light);margin-bottom:1.5rem;">'
    + 'Control how your lot(s) appear on the public properties page and map. Fields marked * are required when listing as For Sale or Rental.</p>'
    + sectionsHtml;
}

function updateListingFormFields(lotNum) {
  const status    = document.getElementById('listing-status-' + lotNum).value;
  const isForSale = status === 'for_sale';
  const isRental  = status === 'rental';
  const isActive  = isForSale || isRental;

  var priceWrap = document.getElementById('listing-price-wrap-' + lotNum);
  if (priceWrap) priceWrap.style.display = isForSale ? '' : 'none';

  var availWrap = document.getElementById('listing-avail-wrap-' + lotNum);
  if (availWrap) availWrap.style.display = isRental ? '' : 'none';

  var acreageReq = document.getElementById('listing-acreage-req-' + lotNum);
  if (acreageReq) acreageReq.style.display = isForSale ? '' : 'none';

  var descReq = document.getElementById('listing-desc-req-' + lotNum);
  if (descReq) descReq.style.display = isActive ? '' : 'none';

  var emailReq = document.getElementById('listing-email-req-' + lotNum);
  if (emailReq) emailReq.style.display = isActive ? '' : 'none';
}

async function saveListing(e, lotNum) {
  e.preventDefault();
  const status             = document.getElementById('listing-status-'  + lotNum).value;
  const acreage            = document.getElementById('listing-acreage-' + lotNum).value.trim();
  const email_contact      = document.getElementById('listing-email-'   + lotNum).value.trim();
  const description        = document.getElementById('listing-desc-'    + lotNum).value.trim();
  const external_sale_url  = document.getElementById('listing-url-'     + lotNum).value.trim();
  const priceEl            = document.getElementById('listing-price-'   + lotNum);
  const availEl            = document.getElementById('listing-avail-'   + lotNum);
  const price              = priceEl ? priceEl.value.trim() : '';
  const availability_notes = availEl ? availEl.value.trim() : '';
  const btn = document.getElementById('listing-save-' + lotNum);

  const isActive = status === 'for_sale' || status === 'rental';

  if (status === 'for_sale' && !acreage) {
    showToast('Acreage is required for For Sale listings.', 'error');
    return;
  }
  if (isActive && !description) {
    showToast('Description is required for For Sale and Rental listings.', 'error');
    return;
  }
  if (isActive && !email_contact) {
    showToast('Contact email is required for For Sale and Rental listings.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';

  if (DEMO_MODE) {
    showToast('Demo mode: listing saved (not persisted).', 'info');
    btn.disabled = false;
    btn.textContent = 'Saved!';
    setTimeout(function () { btn.textContent = 'Save Listing'; }, 1500);
    return;
  }

  const { error } = await sb.from('lot_listings').upsert({
    lot_number: lotNum,
    status,
    acreage: acreage || null,
    price: price || null,
    description: description || null,
    external_sale_url: external_sale_url || null,
    email_contact: email_contact || null,
    availability_notes: availability_notes || null,
    updated_by: currentOwner.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'lot_number' });

  if (error) {
    showToast('Error saving listing: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save Listing';
    return;
  }

  const toastMsg = status === 'for_sale'
    ? 'Lot ' + lotLabel(lotNum) + ' listed for sale.'
    : status === 'rental'
    ? 'Lot ' + lotLabel(lotNum) + ' listed as rental.'
    : 'Lot ' + lotLabel(lotNum) + ' listing updated.';
  showToast(toastMsg, 'success');
  btn.disabled = false;
  btn.textContent = 'Saved!';
  setTimeout(function () { btn.textContent = 'Save Listing'; }, 1500);
}

// =====================================================
// MODAL HELPERS
// =====================================================

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.hidden = false;
    // Focus first focusable element
    const first = modal.querySelector('input, select, textarea, button:not(.modal-close)');
    if (first) setTimeout(function () { first.focus(); }, 50);
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(function (m) {
    m.hidden = true;
  });
}

// Modal overlay click to close
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) {
    closeAllModals();
  }
  if (e.target.classList.contains('modal-close')) {
    closeAllModals();
  }
});

// Escape key closes modals
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeAllModals();
});

// =====================================================
// SIDEBAR NAV WIRING
// =====================================================

document.querySelectorAll('.nav-item[data-tab]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    showTab(btn.dataset.tab);
    // Close mobile sidebar
    document.getElementById('portal-sidebar').classList.remove('open');
    document.querySelector('.sidebar-backdrop') && document.querySelector('.sidebar-backdrop').classList.remove('show');
  });
});

// Mobile menu toggle
(function () {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('portal-sidebar');

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  menuBtn && menuBtn.addEventListener('click', function () {
    const isOpen = sidebar.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
    backdrop.classList.toggle('show', isOpen);
  });

  backdrop.addEventListener('click', function () {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    menuBtn && menuBtn.setAttribute('aria-expanded', 'false');
  });
})();

// Logout
document.getElementById('logout-btn').addEventListener('click', async function () {
  if (!sb) {
    window.location.replace('/member/login.html');
    return;
  }
  await sb.auth.signOut();
  window.location.replace('/member/login.html');
});

// Wire add-due form
document.getElementById('add-due-form').onsubmit = submitAddDue;
document.getElementById('payment-form').onsubmit = submitPayment;

// =====================================================
// UTILITIES
// =====================================================

function lotLabel(n) {
  if (n >= 200) return 'I' + (n - 200);
  if (n >= 100) return 'S' + (n - 100);
  return String(n);
}

function formatCurrency(cents) {
  return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(dt) {
  if (!dt) return '';
  const seconds = Math.floor((Date.now() - new Date(dt).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  return formatDate(dt);
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function docIcon(category) {
  const icons = {
    minutes: '📋',
    covenants: '📜',
    financial: '📊',
    legal: '⚖️',
    other: '📄',
  };
  return icons[category] || '📄';
}

/**
 * Minimal markdown renderer — bold, italic, line breaks only.
 * All input is HTML-escaped first to prevent XSS.
 */
function markdownLite(text) {
  if (!text) return '';
  let out = escHtml(text);
  // Bold: **text**
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Line breaks
  out = out.replace(/\n/g, '<br>');
  return out;
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast toast-' + (type || 'info') + ' show';
  setTimeout(function () {
    toast.classList.remove('show');
  }, 3500);
}

// =====================================================
// TOGGLE FALLBACK — keep .is-checked in sync for browsers without :has()
// =====================================================

document.addEventListener('change', function (e) {
  if (e.target && e.target.closest('.toggle-track')) {
    const track = e.target.closest('.toggle-track');
    track.classList.toggle('is-checked', e.target.checked);
  }
});

// =====================================================
// BOOT
// =====================================================

document.addEventListener('DOMContentLoaded', initAuth);
