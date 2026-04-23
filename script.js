/* ===================================================
   FINCA BUENA VIDA — Main JavaScript
   =================================================== */

'use strict';

// ---- Nav scroll behavior ----
const nav = document.getElementById('site-nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ---- Mobile hamburger ----
const hamburger = document.querySelector('.nav-hamburger');
hamburger?.addEventListener('click', () => {
  nav.classList.toggle('menu-open');
  hamburger.setAttribute('aria-expanded', nav.classList.contains('menu-open'));
});

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => nav.classList.remove('menu-open'));
});

// ---- Scroll fade-in observer ----
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

// ---- Hero particles ----
function initParticles() {
  const container = document.querySelector('.hero-particles');
  if (!container) return;
  const count = window.matchMedia('(max-width: 768px)').matches ? 8 : 18;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    const left = Math.random() * 100;
    const duration = Math.random() * 15 + 12;
    const delay = Math.random() * 12;
    p.style.cssText = `width:${size}px;height:${size}px;left:${left}%;bottom:-10%;animation-duration:${duration}s;animation-delay:-${delay}s;opacity:${Math.random()*0.5+0.1}`;
    container.appendChild(p);
  }
}
initParticles();

// ---- Canopy leaves (hero) ----
function initLeaves() {
  const canopy = document.querySelector('.hero-canopy');
  if (!canopy) return;

  const leafPaths = [
    'M0,0 C10,-30 40,-50 60,-20 C80,10 70,50 40,60 C20,65 -10,50 0,0Z',
    'M0,0 C20,-40 60,-60 80,-20 C100,20 80,70 40,70 C10,70 -15,40 0,0Z',
    'M0,0 C5,-20 30,-45 55,-30 C75,-15 70,30 45,50 C25,65 -10,35 0,0Z',
  ];

  const positions = [
    { top: '-5%', left: '-5%', width: '35%' },
    { top: '-8%', right: '-3%', width: '30%' },
    { top: '0%', left: '25%', width: '25%' },
    { top: '-10%', right: '20%', width: '28%' },
  ];

  positions.forEach((pos, i) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 80');
    svg.setAttribute('class', 'canopy-leaf');
    Object.assign(svg.style, pos, { position: 'absolute' });
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', leafPaths[i % leafPaths.length]);
    path.setAttribute('fill', '#4aab7e');
    svg.appendChild(path);
    canopy.appendChild(svg);
  });
}
initLeaves();

// ---- Supabase init (public anon key — safe in browser) ----
let sb = null;
(function () {
  const cfg = window.FBV_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseAnonKey &&
      !cfg.supabaseUrl.includes('your-project-id') &&
      !cfg.supabaseAnonKey.includes('your-anon-key')) {
    sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
})();

// ---- Helpers ----
function lotLabel(n) {
  if (n >= 200) return 'I' + (n - 200);
  if (n >= 100) return 'S' + (n - 100);
  return String(n);
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url) return '#';
  return /^https?:\/\//i.test(url) ? escHtml(url) : '#';
}

// ---- Load data and render listings ----
let lotsData = null;
let listingsData = null;
let supabaseListings = null;
let supabaseForSale  = null;
let supabaseRentals  = null;

async function loadData() {
  // Always load lots.json for static lot info (name, type, acreage)
  try {
    lotsData = await fetch('data/lots.json').then(r => r.json());
  } catch (err) {
    console.warn('lots.json load failed:', err);
  }

  if (sb) {
    try {
      const { data, error } = await sb
        .from('lot_listings')
        .select('lot_number, status, description, price, acreage, email_contact, availability_notes, external_sale_url')
        .in('status', ['for_sale', 'rental'])
        .order('lot_number');
      if (error) throw error;
      supabaseListings = data || [];
      supabaseForSale  = supabaseListings.filter(function (r) { return r.status === 'for_sale'; });
      supabaseRentals  = supabaseListings.filter(function (r) { return r.status === 'rental'; });
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to JSON:', err.message || err);
      supabaseListings = null;
      supabaseForSale  = null;
      supabaseRentals  = null;
    }
  }

  // Always load listings.json (needed for rentals; also for-sale fallback)
  try {
    listingsData = await fetch('data/listings.json').then(r => r.json());
  } catch (err) {
    console.warn('listings.json load failed:', err);
  }

  renderListings();
}

// ---- Listings ----
function renderListings() {
  renderForSale();
  renderForRent();
}

function getListingImageSVG(type, status) {
  const gradients = {
    oceanfront: ['#1e5c5c', '#2a8080', '#4ab5b5'],
    oceanview:  ['#2d5a3d', '#3d7a55', '#4ab5b5'],
    jungle:     ['#1a3a2a', '#2d5a3d', '#6aab7e'],
    resort:     ['#3d2510', '#6b3f22', '#a0714f'],
  };
  const cols = gradients[type] || gradients.jungle;
  const uid = Math.random().toString(36).slice(2, 8);

  const icons = {
    oceanfront: `<path d="M20 55 Q40 40 60 50 Q80 60 100 45" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none"/>
                 <circle cx="70" cy="25" r="18" fill="rgba(255,255,255,0.08)"/>
                 <ellipse cx="40" cy="72" rx="25" ry="8" fill="rgba(255,255,255,0.06)"/>`,
    oceanview:  `<path d="M10 60 Q30 45 50 55 Q70 65 100 50" stroke="rgba(255,255,255,0.3)" stroke-width="2" fill="none"/>
                 <path d="M60 20 L80 50 L40 50Z" fill="rgba(255,255,255,0.07)"/>`,
    jungle:     `<circle cx="30" cy="35" r="22" fill="rgba(106,171,126,0.2)"/>
                 <circle cx="65" cy="25" r="28" fill="rgba(106,171,126,0.15)"/>
                 <circle cx="80" cy="45" r="18" fill="rgba(106,171,126,0.18)"/>`,
    resort:     `<rect x="30" y="40" width="40" height="30" rx="4" fill="rgba(255,255,255,0.08)"/>
                 <rect x="45" y="30" width="12" height="14" rx="2" fill="rgba(255,255,255,0.06)"/>`,
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" style="width:100%;height:100%;object-fit:cover">
    <defs>
      <linearGradient id="g-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${cols[0]}"/>
        <stop offset="50%" style="stop-color:${cols[1]}"/>
        <stop offset="100%" style="stop-color:${cols[2]}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="80" fill="url(#g-${uid})"/>
    ${icons[type] || icons.jungle}
  </svg>`;
}

function renderForSale() {
  const grid = document.getElementById('for-sale-grid');
  if (!grid) return;

  let items;
  if (supabaseForSale !== null) {
    items = supabaseForSale;
  } else if (listingsData && listingsData.forSale) {
    items = listingsData.forSale.map(l => ({
      lot_number: l.lotNumber,
      status: 'for_sale',
      price: l.price,
      description: l.description,
      acreage: null,
      email_contact: null,
      external_sale_url: null,
    }));
  } else {
    items = [];
  }

  if (items.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--text-light);font-style:italic">No lots are currently listed for sale. Check back soon.</div>';
    return;
  }

  grid.innerHTML = items.map(row => {
    const lotName   = lotLabel(row.lot_number);
    const lotInfo   = lotsData && lotsData.lots
      ? (lotsData.lots.find(l => l.id === row.lot_number) || null)
      : null;
    const lotType   = lotInfo ? lotInfo.type : (row.lot_number < 200 ? 'shore' : 'inland');
    const acreage   = row.acreage || (lotInfo && lotInfo.acreage ? lotInfo.acreage : null);
    const typeLabel = lotType === 'shore' ? 'Shore Lot' : 'Inland Lot';
    const imgType   = lotType === 'shore' ? 'oceanfront' : 'jungle';

    const acreageLine = `<span><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1C4.7 1 2 3.7 2 7c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg> ${acreage ? escHtml(acreage) + ' acres' : '—'}</span>`;

    const descLine = `<p class="listing-description">${row.description ? escHtml(row.description) : '<em style="opacity:0.5">No description provided.</em>'}</p>`;

    const priceLine = row.price
      ? `<p class="listing-description" style="margin-top:0.25rem"><strong>Asking:</strong> ${escHtml(row.price)}</p>`
      : '';

    const ctaBtn = row.external_sale_url
      ? `<a href="${safeUrl(row.external_sale_url)}" class="listing-contact" target="_blank" rel="noopener">View Listing</a>`
      : row.email_contact
      ? `<a href="mailto:${escHtml(row.email_contact)}?subject=${encodeURIComponent('Inquiry: Lot ' + lotName)}" class="listing-contact">Inquire</a>`
      : '';

    return `
      <div class="listing-card fade-in" id="lot-${escHtml(lotName)}">
        <div class="listing-image">
          <img src="assets/images/${escHtml(lotName)}.jpg" alt="Lot ${escHtml(lotName)}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:1" onerror="this.remove()">
          <div class="listing-image-placeholder">
            ${getListingImageSVG(imgType, 'for_sale')}
          </div>
          <span class="listing-badge for-sale" style="z-index:2">For Sale</span>
          <span class="listing-type-badge" style="z-index:2">${typeLabel}</span>
        </div>
        <div class="listing-body">
          <div class="listing-lot">Lot ${escHtml(lotName)}</div>
          <h3 class="listing-title">${typeLabel} ${escHtml(lotName)}</h3>
          <div class="listing-meta">
            ${acreageLine}
            <span>${typeLabel}</span>
          </div>
          ${descLine}
          ${priceLine}
          <div class="listing-footer" style="justify-content:flex-end">
            ${ctaBtn}
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
}

function renderLotRentalCard(row) {
  const lotName   = lotLabel(row.lot_number);
  const lotInfo   = lotsData && lotsData.lots
    ? (lotsData.lots.find(l => l.id === row.lot_number) || null)
    : null;
  const lotType   = lotInfo ? lotInfo.type : (row.lot_number < 200 ? 'shore' : 'inland');
  const acreage   = row.acreage || (lotInfo && lotInfo.acreage ? lotInfo.acreage : null);
  const typeLabel = lotType === 'shore' ? 'Shore Lot' : 'Inland Lot';
  const imgType   = lotType === 'shore' ? 'oceanfront' : 'jungle';

  const acreageLine = `<span><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1C4.7 1 2 3.7 2 7c0 4.5 6 8 6 8s6-3.5 6-8c0-3.3-2.7-6-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg> ${acreage ? escHtml(acreage) + ' acres' : '—'}</span>`;

  const descLine = `<p class="listing-description">${row.description ? escHtml(row.description) : '<em style="opacity:0.5">No description provided.</em>'}</p>`;

  const availLine = row.availability_notes
    ? `<p class="listing-description" style="margin-top:0.25rem"><strong>Availability:</strong> ${escHtml(row.availability_notes)}</p>`
    : '';

  const ctaBtn = row.external_sale_url
    ? `<a href="${safeUrl(row.external_sale_url)}" class="listing-contact" target="_blank" rel="noopener">View Listing</a>`
    : row.email_contact
    ? `<a href="mailto:${escHtml(row.email_contact)}?subject=${encodeURIComponent('Rental Inquiry: Lot ' + lotName)}" class="listing-contact">Inquire</a>`
    : '';

  return `
    <div class="listing-card fade-in" id="lot-rental-${escHtml(lotName)}">
      <div class="listing-image">
        <img src="assets/images/${escHtml(lotName)}.jpg" alt="Lot ${escHtml(lotName)}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;z-index:1" onerror="this.remove()">
        <div class="listing-image-placeholder">
          ${getListingImageSVG(imgType, 'rental')}
        </div>
        <span class="listing-badge rental" style="z-index:2">Rental</span>
        <span class="listing-type-badge" style="z-index:2">${typeLabel}</span>
      </div>
      <div class="listing-body">
        <div class="listing-lot">Lot ${escHtml(lotName)}</div>
        <h3 class="listing-title">${typeLabel} ${escHtml(lotName)}</h3>
        <div class="listing-meta">
          ${acreageLine}
          <span>${typeLabel}</span>
        </div>
        ${descLine}
        ${availLine}
        <div class="listing-footer" style="justify-content:flex-end">
          ${ctaBtn}
        </div>
      </div>
    </div>
  `;
}

function renderForRent() {
  const grid = document.getElementById('for-rent-grid');
  if (!grid || !listingsData?.forRent) return;

  let hasAirbnb = false;

  const airbnbIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5c1.243 0 2.25 1.007 2.25 2.25S13.243 9 12 9 9.75 7.993 9.75 6.75 10.757 4.5 12 4.5zm5.25 13.5H6.75c-.414 0-.75-.336-.75-.75 0-3.176 2.268-5.813 5.25-6.408V9.75h1.5v1.092c2.982.595 5.25 3.232 5.25 6.408 0 .414-.336.75-.75.75z"/></svg>`;

  const lotRentalHtml = (supabaseRentals && supabaseRentals.length)
    ? supabaseRentals.map(renderLotRentalCard).join('')
    : '';

  grid.innerHTML = lotRentalHtml + listingsData.forRent.map(listing => {
    let imageBlock;
    if (listing.image) {
      imageBlock = `<div class="listing-image">
           <img src="${escHtml(listing.image)}" alt="${escHtml(listing.title)}" style="width:100%;height:100%;object-fit:cover;">
           <span class="listing-badge for-rent">${escHtml(listing.badge || 'For Rent')}</span>
         </div>`;
    } else if (listing.airbnbId) {
      imageBlock = `<div class="listing-image listing-image--airbnb">
           <div class="airbnb-embed-frame" data-id="${escHtml(listing.airbnbId)}" data-view="home" data-hide-price="true" style="width:100%;height:300px;"></div>
           <span class="listing-badge for-rent">${escHtml(listing.badge || 'For Rent')}</span>
         </div>`;
      hasAirbnb = true;
    } else {
      imageBlock = `<div class="listing-image">
           <div class="listing-image-placeholder">
             ${getListingImageSVG(listing.type, 'for-rent')}
           </div>
           <span class="listing-badge for-rent">${escHtml(listing.badge || (listing.externalOnly ? 'External' : 'For Rent'))}</span>
           ${listing.type !== 'resort' ? `<span class="listing-type-badge">${listing.type.replace('-', ' ')}</span>` : ''}
         </div>`;
    }

    const unitsHtml = listing.airbnbUnits && listing.airbnbUnits.length
      ? `<div class="listing-airbnb-units">
           ${listing.airbnbUnits.map(u => `<a href="https://www.airbnb.com/rooms/${escHtml(u.id)}" class="airbnb-unit-link" target="_blank" rel="noopener">${airbnbIcon}${escHtml(u.name)}</a>`).join('')}
         </div>`
      : '';

    const ctaBtn = listing.website
      ? `<a href="${safeUrl(listing.website)}" class="listing-contact" target="_blank" rel="noopener">Visit Website</a>`
      : listing.bookingLink
      ? `<a href="${safeUrl(listing.bookingLink)}" class="listing-contact" target="_blank" rel="noopener">${listing.airbnbId ? 'Book on Airbnb' : 'Visit Site'}</a>`
      : `<button class="listing-contact" onclick="openContactModal('${escHtml(listing.id)}', '${listing.title.replace(/'/g, "\\'")}')">Request Info</button>`;

    return `
    <div class="listing-card ${listing.externalOnly ? 'external-only' : ''} fade-in">
      ${imageBlock}
      <div class="listing-body">
        ${listing.lotNumber ? `<div class="listing-lot">Lot ${listing.lotNumber}</div>` : ''}
        <h3 class="listing-title">${escHtml(listing.title)}</h3>
        <p class="listing-description">${escHtml(listing.shortDescription)}</p>
        ${listing.amenities.length ? `
          <div class="listing-features">
            ${listing.amenities.map(a => `<span class="feature-tag">${escHtml(a)}</span>`).join('')}
          </div>
        ` : ''}
        ${unitsHtml}
        <div class="listing-footer" style="justify-content:flex-end">
          ${ctaBtn}
        </div>
      </div>
    </div>
  `;
  }).join('');

  grid.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

  if (hasAirbnb && !document.querySelector('script[src*="airbnb_jssdk"]')) {
    const s = document.createElement('script');
    s.src = 'https://www.airbnb.com/embeddable/airbnb_jssdk';
    s.async = true;
    document.body.appendChild(s);
  }
}

function handleRentContact(e, id) {
  e.preventDefault();
  const listing = listingsData?.forRent?.find(l => l.id === id);
  if (listing) openContactModal(id, listing.title);
  return false;
}

// ---- Tabs ----
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target)?.classList.add('active');
  });
});

// ---- Contact modal ----
const contactModal = document.getElementById('contact-modal');
const contactSubject = document.getElementById('contact-subject');

function openContactModal(listingId, listingTitle) {
  if (contactSubject && listingTitle) {
    contactSubject.value = listingTitle;
  }
  contactModal?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeContactModal() {
  contactModal?.classList.remove('open');
  document.body.style.overflow = '';
}

window.openContactModal = openContactModal;
window.handleRentContact = handleRentContact;

document.querySelector('.modal-overlay')?.addEventListener('click', closeContactModal);
document.querySelector('.modal-close')?.addEventListener('click', closeContactModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeContactModal();
});

document.getElementById('contact-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  btn.textContent = 'Sent! We\'ll be in touch.';
  btn.style.background = 'var(--green-mid)';
  btn.disabled = true;
  setTimeout(closeContactModal, 2000);
});

// ---- Smooth scroll for anchor links ----
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ---- Island section sub-nav scrollspy ----
function initIslandScrollspy() {
  const links = document.querySelectorAll('.island-subnav-link');
  if (!links.length) return;
  const chapters = Array.from(links).map(l => document.querySelector(l.getAttribute('href'))).filter(Boolean);
  const activate = () => {
    const mid = window.scrollY + window.innerHeight * 0.35;
    let active = chapters[0];
    for (const ch of chapters) {
      if (ch.getBoundingClientRect().top + window.scrollY <= mid) active = ch;
    }
    links.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === '#' + active.id);
    });
  };
  window.addEventListener('scroll', activate, { passive: true });
  activate();
}

// ---- Climate chart data ----
const climateData = [
  { month: 'Jan', rain: 3.1,  high: 86, low: 74 },
  { month: 'Feb', rain: 2.0,  high: 87, low: 74 },
  { month: 'Mar', rain: 2.4,  high: 88, low: 75 },
  { month: 'Apr', rain: 4.2,  high: 88, low: 76 },
  { month: 'May', rain: 9.8,  high: 87, low: 76 },
  { month: 'Jun', rain: 8.1,  high: 86, low: 76 },
  { month: 'Jul', rain: 7.6,  high: 86, low: 76 },
  { month: 'Aug', rain: 8.9,  high: 87, low: 76 },
  { month: 'Sep', rain: 11.2, high: 86, low: 76 },
  { month: 'Oct', rain: 12.4, high: 85, low: 75 },
  { month: 'Nov', rain: 10.1, high: 85, low: 75 },
  { month: 'Dec', rain: 5.3,  high: 85, low: 74 },
];

// ---- Climate chart ----
function initClimateChart() {
  const svgEl = document.getElementById('climate-chart');
  if (!svgEl) return;

  const NS = 'http://www.w3.org/2000/svg';
  const VW = 660, VH = 260;
  const PT = 28, PR = 52, PB = 38, PL = 48;
  const CW = VW - PL - PR;   // 560
  const CH = VH - PT - PB;   // 194
  const COL = CW / 12;
  const BAR = Math.floor(COL * 0.52);

  let tempUnit = 'f', rainUnit = 'in';
  let animVals = climateData.map(() => ({ rain: 0, highF: 74, lowF: 74 }));
  let rafId = null;

  const RAIN_MAX = 14;
  const TF_MIN = 70, TF_MAX = 95;

  function xc(i) { return PL + (i + 0.5) * COL; }

  function yTemp(vF) {
    const tmin = tempUnit === 'c' ? (TF_MIN - 32) * 5 / 9 : TF_MIN;
    const tmax = tempUnit === 'c' ? (TF_MAX - 32) * 5 / 9 : TF_MAX;
    const v = tempUnit === 'c' ? (vF - 32) * 5 / 9 : vF;
    return PT + CH - ((v - tmin) / (tmax - tmin)) * CH;
  }

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // Static layer
  const sg = el('g', {});

  // Season fills
  sg.appendChild(el('rect', { x: PL, y: PT, width: COL * 4, height: CH, fill: 'rgba(210,160,40,0.07)' }));
  sg.appendChild(el('rect', { x: PL + COL * 4, y: PT, width: COL * 7, height: CH, fill: 'rgba(70,150,210,0.07)' }));

  // Grid lines
  [0.33, 0.67].forEach(f => {
    sg.appendChild(el('line', { x1: PL, y1: PT + CH * (1 - f), x2: PL + CW, y2: PT + CH * (1 - f), stroke: 'rgba(26,58,42,0.07)', 'stroke-dasharray': '3,4' }));
  });

  // X axis
  sg.appendChild(el('line', { x1: PL, y1: PT + CH, x2: PL + CW, y2: PT + CH, stroke: 'rgba(26,58,42,0.15)' }));

  // Month labels
  climateData.forEach((d, i) => {
    const t = el('text', { x: xc(i), y: VH - 7, 'text-anchor': 'middle', 'font-size': '9', fill: 'rgba(26,58,42,0.45)', 'font-family': 'inherit' });
    t.textContent = d.month;
    sg.appendChild(t);
  });

  // Season labels
  const dry = el('text', { x: PL + 2 * COL, y: PT + 14, 'text-anchor': 'middle', 'font-size': '8.5', fill: 'rgba(170,110,20,0.42)', 'font-family': 'inherit' });
  dry.textContent = 'DRY';
  sg.appendChild(dry);
  const wet = el('text', { x: PL + 7.5 * COL, y: PT + 14, 'text-anchor': 'middle', 'font-size': '8.5', fill: 'rgba(50,130,190,0.42)', 'font-family': 'inherit' });
  wet.textContent = 'WET SEASON';
  sg.appendChild(wet);

  // Axis labels
  const rlbl = el('text', { x: 11, y: PT + CH / 2, 'text-anchor': 'middle', 'font-size': '9', fill: 'rgba(74,181,181,0.65)', 'font-family': 'inherit', transform: `rotate(-90 11 ${PT + CH / 2})` });
  rlbl.textContent = 'Rainfall';
  sg.appendChild(rlbl);
  const tlbl = el('text', { x: VW - 11, y: PT + CH / 2, 'text-anchor': 'middle', 'font-size': '9', fill: 'rgba(217,100,74,0.65)', 'font-family': 'inherit', transform: `rotate(90 ${VW - 11} ${PT + CH / 2})` });
  tlbl.textContent = 'Temp';
  sg.appendChild(tlbl);

  svgEl.appendChild(sg);

  // Dynamic layer
  const dg = el('g', {});
  const rainTickG = el('g', {});
  const tempTickG = el('g', {});

  // Rain bars
  const bars = climateData.map((_, i) => {
    const r = el('rect', { x: PL + i * COL + (COL - BAR) / 2, y: PT + CH, width: BAR, height: 0, rx: 2, fill: 'rgba(74,181,181,0.72)' });
    dg.appendChild(r);
    return r;
  });

  // Temp band
  const band = el('polygon', { points: '', fill: 'rgba(217,100,74,0.1)' });
  dg.appendChild(band);

  // Low dashed line
  const lowLine = el('polyline', { points: '', fill: 'none', stroke: 'rgba(217,100,74,0.38)', 'stroke-width': '1.5', 'stroke-dasharray': '4,3', 'stroke-linejoin': 'round' });
  dg.appendChild(lowLine);

  // High solid line
  const highLine = el('polyline', { points: '', fill: 'none', stroke: '#d9644a', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  dg.appendChild(highLine);

  // High dots
  const dots = climateData.map((_, i) => {
    const c = el('circle', { cx: xc(i), cy: PT + CH, r: 3, fill: '#d9644a' });
    dg.appendChild(c);
    return c;
  });

  dg.appendChild(rainTickG);
  dg.appendChild(tempTickG);

  // Hover rects
  const tooltip = document.getElementById('climate-tooltip');
  climateData.forEach((_, i) => {
    const hr = el('rect', { x: PL + i * COL, y: PT, width: COL, height: CH, fill: 'transparent', style: 'cursor:crosshair' });
    hr.addEventListener('mouseenter', () => showTip(i));
    hr.addEventListener('mouseleave', hideTip);
    dg.appendChild(hr);
  });

  svgEl.appendChild(dg);

  // Render
  function renderChart() {
    const maxR = rainUnit === 'mm' ? RAIN_MAX * 25.4 : RAIN_MAX;

    animVals.forEach((v, i) => {
      const rv = rainUnit === 'mm' ? v.rain * 25.4 : v.rain;
      const bh = Math.max(0, (rv / maxR) * CH);
      bars[i].setAttribute('y', PT + CH - bh);
      bars[i].setAttribute('height', bh);
    });

    const hiArr = animVals.map((v, i) => `${xc(i)},${yTemp(v.highF)}`);
    const loArr = animVals.map((v, i) => `${xc(i)},${yTemp(v.lowF)}`);
    highLine.setAttribute('points', hiArr.join(' '));
    lowLine.setAttribute('points', loArr.join(' '));
    band.setAttribute('points', [...hiArr, ...[...loArr].reverse()].join(' '));
    animVals.forEach((v, i) => dots[i].setAttribute('cy', yTemp(v.highF)));

    // Rain axis ticks
    while (rainTickG.firstChild) rainTickG.removeChild(rainTickG.firstChild);
    const rTicks = rainUnit === 'mm' ? [90, 180, 270] : [3.5, 7, 10.5];
    rTicks.forEach(r => {
      const yy = PT + CH - (r / maxR) * CH;
      const t = el('text', { x: PL - 4, y: yy + 3.5, 'text-anchor': 'end', 'font-size': '9', fill: 'rgba(74,181,181,0.6)', 'font-family': 'inherit' });
      t.textContent = rainUnit === 'mm' ? String(r) : r + '"';
      rainTickG.appendChild(t);
    });

    // Temp axis ticks
    while (tempTickG.firstChild) tempTickG.removeChild(tempTickG.firstChild);
    const tmin = tempUnit === 'c' ? (TF_MIN - 32) * 5 / 9 : TF_MIN;
    const tmax = tempUnit === 'c' ? (TF_MAX - 32) * 5 / 9 : TF_MAX;
    const tTicks = tempUnit === 'c' ? [23, 26, 29, 32] : [74, 79, 84, 89];
    tTicks.forEach(t => {
      const yy = PT + CH - ((t - tmin) / (tmax - tmin)) * CH;
      if (yy < PT - 4 || yy > PT + CH + 4) return;
      const te = el('text', { x: PL + CW + 5, y: yy + 3.5, 'font-size': '9', fill: 'rgba(217,100,74,0.6)', 'font-family': 'inherit' });
      te.textContent = t + '\u00b0';
      tempTickG.appendChild(te);
    });
  }

  // Animate
  function animateTo(targets, dur = 480) {
    const from = animVals.map(v => ({ ...v }));
    const t0 = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      animVals = from.map((f, i) => ({
        rain:  f.rain  + (targets[i].rain  - f.rain)  * e,
        highF: f.highF + (targets[i].highF - f.highF) * e,
        lowF:  f.lowF  + (targets[i].lowF  - f.lowF)  * e,
      }));
      renderChart();
      if (p < 1) rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
  }

  // Tooltip
  function showTip(i) {
    if (!tooltip) return;
    const d = climateData[i];
    const rv = rainUnit === 'mm' ? (d.rain * 25.4).toFixed(0) + ' mm' : d.rain.toFixed(1) + '"';
    const hi = tempUnit === 'c' ? ((d.high - 32) * 5 / 9).toFixed(0) + '°C' : d.high + '°F';
    const lo = tempUnit === 'c' ? ((d.low  - 32) * 5 / 9).toFixed(0) + '°C' : d.low  + '°F';
    tooltip.innerHTML = `<strong>${d.month}</strong> &nbsp;Rain: ${rv} &nbsp;·&nbsp; High: ${hi} &nbsp;·&nbsp; Low: ${lo}`;
    const outer = tooltip.parentElement.getBoundingClientRect();
    const sr    = svgEl.getBoundingClientRect();
    tooltip.style.left = (xc(i) * (sr.width / VW) + sr.left - outer.left) + 'px';
    tooltip.style.top  = ((PT + CH * 0.38) * (sr.height / VH) + sr.top - outer.top) + 'px';
    tooltip.removeAttribute('hidden');
  }
  function hideTip() { tooltip && tooltip.setAttribute('hidden', ''); }

  // Unit toggle buttons
  document.querySelectorAll('.climate-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.climate-unit-toggle').querySelectorAll('.climate-toggle-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (btn.dataset.unit === 'temp') tempUnit = btn.dataset.val;
      else rainUnit = btn.dataset.val;
      renderChart();
    });
  });

  // Render static state immediately (ticks, grid, flat lines)
  renderChart();

  // Animate bars/lines when chart enters viewport — scroll-listener approach
  // (more reliable than IntersectionObserver when parent has opacity:0)
  const chartOuter = svgEl.parentElement;
  const targets = climateData.map(d => ({ rain: d.rain, highF: d.high, lowF: d.low }));
  let animated = false;

  function maybeAnimate() {
    if (animated) return;
    const r = chartOuter.getBoundingClientRect();
    if (r.top < window.innerHeight + 80 && r.bottom > 0) {
      animated = true;
      window.removeEventListener('scroll', maybeAnimate, true);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animVals = targets.map(v => ({ ...v }));
        renderChart();
      } else {
        animateTo(targets);
      }
    }
  }

  window.addEventListener('scroll', maybeAnimate, { passive: true });
  // Also check immediately (catches cases where section is already in view)
  requestAnimationFrame(maybeAnimate);
}

// ---- WMO icon helper ----
function wmoIcon(code, size) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.5');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');

  function p(d, extra) {
    const e = document.createElementNS(NS, 'path');
    e.setAttribute('d', d);
    if (extra) Object.entries(extra).forEach(([k, v]) => e.setAttribute(k, v));
    s.appendChild(e);
  }
  function c(cx, cy, r, extra) {
    const e = document.createElementNS(NS, 'circle');
    e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('r', r);
    if (extra) Object.entries(extra).forEach(([k, v]) => e.setAttribute(k, v));
    s.appendChild(e);
  }

  if (code === 0) {
    // Sun
    c(12, 12, 4);
    for (let a = 0; a < 8; a++) {
      const r = (a * 45) * Math.PI / 180;
      const x1 = (12 + 6.5 * Math.cos(r)).toFixed(1), y1 = (12 + 6.5 * Math.sin(r)).toFixed(1);
      const x2 = (12 + 8.5 * Math.cos(r)).toFixed(1), y2 = (12 + 8.5 * Math.sin(r)).toFixed(1);
      p(`M${x1},${y1} L${x2},${y2}`);
    }
  } else if (code <= 2) {
    // Partly cloudy
    c(10, 10, 3.5);
    for (let a = -135; a <= 45; a += 45) {
      const r = a * Math.PI / 180;
      p(`M${(10 + 5.5 * Math.cos(r)).toFixed(1)},${(10 + 5.5 * Math.sin(r)).toFixed(1)} L${(10 + 7.2 * Math.cos(r)).toFixed(1)},${(10 + 7.2 * Math.sin(r)).toFixed(1)}`);
    }
    p('M7,17 Q5,17 5,15 Q5,13 7,13 Q8,10 11,10 Q14,10 15,12 Q17,12 17,14 Q17,16 15,16 Q12,17 9,17 Z', { fill: 'rgba(255,255,255,0.12)' });
  } else if (code === 3) {
    // Overcast
    p('M5,16 Q3,16 3,14 Q3,12 5,12 Q6,9 10,9 Q14,9 15,12 Q18,12 18,14.5 Q18,16 16,16 Z', { fill: 'rgba(255,255,255,0.12)' });
    p('M6,19 Q4,19 4,17 Q4,15 6,15 Q7,12 12,12 Q17,12 18,15 Q20,15 20,17 Q20,19 18,19 Z', { fill: 'rgba(255,255,255,0.12)' });
  } else if (code <= 48) {
    // Fog
    [9, 12, 15].forEach(y => p(`M4,${y} L20,${y}`, { 'stroke-opacity': y === 12 ? '0.85' : '0.4' }));
  } else if (code <= 67 || (code >= 80 && code <= 82)) {
    // Rain
    p('M5,13 Q4,13 4,11 Q4,9 6,9 Q7,6 12,6 Q17,6 18,9 Q20,9 20,11 Q20,13 18,13 Z', { fill: 'rgba(255,255,255,0.1)' });
    const drops = code <= 55
      ? [[9,18],[12,17],[15,18]]
      : [[8,18],[11,17],[14,18],[9.5,20.5],[12.5,20.5]];
    drops.forEach(([x, y]) => p(`M${x},${y - 1.2} L${x},${y + 1.2}`));
  } else if (code >= 95) {
    // Thunder
    p('M4,13 Q3,13 3,11 Q3,9 5,9 Q6,6 11,6 Q16,6 17,9 Q19,9 19,11 Q19,13 17,13 Z', { fill: 'rgba(255,255,255,0.1)' });
    p('M13,13 L10,18 L12.5,18 L9,23', { stroke: '#f0c040', 'stroke-width': '2' });
  } else {
    // Cloud default
    p('M4,15 Q3,15 3,13 Q3,11 5,11 Q6,8 12,8 Q18,8 19,12 Q21,12 21,14 Q21,16 19,16 Q16,17 12,17 Q8,17 5,16 Z', { fill: 'rgba(255,255,255,0.1)' });
  }
  return s;
}

function wmoLabel(code) {
  if (code === 0)  return 'Clear';
  if (code <= 2)   return 'Partly Cloudy';
  if (code === 3)  return 'Overcast';
  if (code <= 48)  return 'Foggy';
  if (code <= 55)  return 'Drizzle';
  if (code <= 67)  return 'Rain';
  if (code <= 82)  return 'Showers';
  if (code >= 95)  return 'Thunderstorm';
  return 'Cloudy';
}

// ---- Weather widget ----
function initWeatherWidget() {
  const widget = document.getElementById('weather-widget');
  const toggle = document.getElementById('weather-toggle');
  const panel  = document.getElementById('weather-panel');
  if (!widget || !toggle || !panel) return;

  const API = 'https://api.open-meteo.com/v1/forecast?latitude=9.3167&longitude=-82.2833' +
    '&current_weather=true' +
    '&daily=weathercode,temperature_2m_max,temperature_2m_min' +
    '&timezone=America%2FPanama&forecast_days=5&temperature_unit=fahrenheit&windspeed_unit=mph';

  // Toggle expand/collapse
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = panel.hasAttribute('hidden');
    panel.toggleAttribute('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    widget.toggleAttribute('data-open', open);
  });

  document.addEventListener('click', e => {
    if (!widget.contains(e.target)) {
      panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      widget.removeAttribute('data-open');
    }
  });

  // Fetch + render
  async function fetchWeather() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(res.status);
      renderWeather(await res.json());
    } catch (err) {
      console.error('Weather fetch failed:', err);
      document.getElementById('weather-pill-temp').textContent = '--°F';
    }
  }

  function renderWeather(data) {
    const cw    = data.current_weather;
    const daily = data.daily;
    const tempF = Math.round(cw.temperature);
    const code  = cw.weathercode;
    const wind  = Math.round(cw.windspeed);

    // Pill
    document.getElementById('weather-pill-temp').textContent = `${tempF}°F`;
    const pillIcon = document.getElementById('weather-pill-icon');
    pillIcon.innerHTML = '';
    pillIcon.appendChild(wmoIcon(code, 18));

    // Panel header
    document.getElementById('weather-panel-temp').textContent = `${tempF}°F`;
    document.getElementById('weather-panel-desc').textContent = wmoLabel(code);
    const panelIcon = document.getElementById('weather-panel-icon');
    panelIcon.innerHTML = '';
    panelIcon.appendChild(wmoIcon(code, 36));

    // Local time (Panama = UTC-5, no DST)
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Panama',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date());
    const timeEl = document.getElementById('weather-panel-time');
    if (timeEl) timeEl.textContent = 'Local time: ' + localTime;

    // Details row
    document.getElementById('weather-panel-details').innerHTML =
      `<span>Wind ${wind} mph</span>` +
      `<span>${wmoLabel(code)}</span>`;

    // 5-day forecast
    const forecastEl = document.getElementById('weather-forecast');
    forecastEl.innerHTML = '';
    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let i = 0; i < 5; i++) {
      const date = new Date(daily.time[i] + 'T12:00:00');
      const hi = Math.round(daily.temperature_2m_max[i]);
      const lo = Math.round(daily.temperature_2m_min[i]);
      const dc = daily.weathercode[i];
      const dayEl = document.createElement('div');
      dayEl.className = 'weather-forecast-day';
      const lbl = document.createElement('span');
      lbl.className = 'weather-forecast-label';
      lbl.textContent = DAY_NAMES[date.getDay()];
      const hiEl = document.createElement('span');
      hiEl.className = 'weather-forecast-temp';
      hiEl.textContent = `${hi}°`;
      const loEl = document.createElement('span');
      loEl.className = 'weather-forecast-lo';
      loEl.textContent = `${lo}°`;
      dayEl.appendChild(lbl);
      dayEl.appendChild(wmoIcon(dc, 20));
      dayEl.appendChild(hiEl);
      dayEl.appendChild(loEl);
      forecastEl.appendChild(dayEl);
    }
  }

  fetchWeather();
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initIslandScrollspy();
  try { initClimateChart(); } catch(e) { console.error('initClimateChart failed:', e); }
  try { initWeatherWidget(); } catch(e) { console.error('initWeatherWidget failed:', e); }
});
