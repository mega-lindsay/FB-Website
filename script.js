/* Federal Benefits Exchange — Landing Page JS */

// --- Global Header Injection & Navigation ---
(function() {
  const header = document.getElementById('header');
  if (!header) return;

  // Skip link — first focusable element, lets keyboard/AT users jump past nav.
  if (!document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main';
    skip.textContent = 'Skip to content';
    document.body.insertBefore(skip, document.body.firstChild);
  }

  const isIndex = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
  // Detect if we're in a subdirectory (e.g. /blog/) and prefix paths accordingly
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const isSubDir = pathSegments.length > 1; // e.g. /blog/some-post.html
  const prefix = isSubDir ? '../' : '';
  const baseUrl = isIndex ? '' : "/";

  header.innerHTML = `
    <div class="container">
      <div class="header-inner">
        <a href="${isIndex ? '#' : "/"}" class="logo" aria-label="Federal Benefits Exchange">
          <img src="/logo.png" alt="Federal Benefits Exchange Logo" class="logo-img" width="2502" height="350" fetchpriority="high" />
        </a>
        <nav class="header-nav">
          <a href="/about/">About</a>
          <a href="/blog/">Blog</a>
          <a href="/faq/">FAQ</a>
          <a href="/resources/">Resources</a>
          <a href="/glossary/">Glossary</a>
          <a href="/contact/">Contact</a>
          <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">
            <svg class="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <svg class="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          </button>
          <a href="${baseUrl}#save-your-seat" class="btn btn-outline btn-sm">Register Free</a>
        </nav>
        <button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
      <div class="mobile-nav" id="mobileNav">
        <a href="/about/" onclick="closeMobileNav()">About</a>
        <a href="/blog/" onclick="closeMobileNav()">Blog</a>
        <a href="/faq/" onclick="closeMobileNav()">FAQ</a>
        <a href="/resources/" onclick="closeMobileNav()">Resources</a>
        <a href="/glossary/" onclick="closeMobileNav()">Glossary</a>
        <a href="/contact/" onclick="closeMobileNav()">Contact</a>
      </div>
    </div>
  `;

    // --- Scroll-aware header fallback ---
  if (!CSS.supports('animation-timeline', 'scroll()')) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 60) header.classList.add('header--scrolled');
      else header.classList.remove('header--scrolled');
    }, { passive: true });
  }

  // --- Mobile Nav Logic ---
  const menuBtn = document.getElementById('menuBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuBtn.innerHTML = isOpen
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    });
  }
})();

function closeMobileNav() {
  const mobileNav = document.getElementById('mobileNav');
  const menuBtn = document.getElementById('menuBtn');
  if (mobileNav) {
    mobileNav.classList.remove('is-open');
    if (menuBtn) {
      menuBtn.setAttribute('aria-label', 'Open menu');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    }
  }
}

// --- FAQ Accordion fallback for older browsers ---
(function() {
  const detailsElements = document.querySelectorAll('details[name="faq-accordion"]');
  detailsElements.forEach(targetDetails => {
    targetDetails.addEventListener('toggle', () => {
      if (targetDetails.open) {
        detailsElements.forEach(detail => {
          if (detail !== targetDetails && detail.open) {
            detail.open = false;
          }
        });
      }
    });
  });
})();

// --- Scroll reveal (progressive enhancement) ---
// Content is visible by default. We only hide-then-reveal when we can do it
// reliably (IntersectionObserver, motion allowed). This avoids content getting
// stuck invisible in environments where CSS scroll-driven animations misfire.
(function() {
  const SELECTOR = '.benefit-card, .testimonial-card, .faq-item, .section-header, .who-content, .register-content';
  const els = document.querySelectorAll(SELECTOR);
  if (!els.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || !('IntersectionObserver' in window)) {
    return; // leave everything visible, no animation
  }

  els.forEach(el => el.classList.add('animate-in'));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => observer.observe(el));

  // Safety net: never let content stay hidden, even if the observer misfires.
  setTimeout(() => els.forEach(el => el.classList.add('visible')), 3000);
})();

// --- Phone formatting ---
const phoneInput = document.getElementById('phone');
if (phoneInput) {
  phoneInput.addEventListener('input', e => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 3) val = val;
    else if (val.length <= 6) val = `(${val.slice(0,3)}) ${val.slice(3)}`;
    else val = `(${val.slice(0,3)}) ${val.slice(3,6)}-${val.slice(6,10)}`;
    e.target.value = val;
  });
}

// --- Populate webinar dates from the single schedule source (/api/schedule) ---
(function() {
  const select = document.getElementById('webinarDate');
  if (!select) return;
  fetch('/api/schedule')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      const webinars = (data && data.webinars) || [];
      if (!webinars.length) throw new Error('no upcoming dates');
      select.innerHTML = '';
      webinars.forEach((w, idx) => {
        const opt = document.createElement('option');
        opt.value = w.iso;
        opt.textContent = w.human;
        if (idx === 0) opt.selected = true;
        select.appendChild(opt);
      });

      // Keep the Event structured data's startDate fresh (next session).
      const schemaEl = document.getElementById('eventSchema');
      if (schemaEl) {
        try {
          const obj = JSON.parse(schemaEl.textContent);
          obj.startDate = webinars[0].iso;
          obj.endDate = webinars[0].iso.replace('T14:00:00', 'T15:00:00');
          schemaEl.textContent = JSON.stringify(obj, null, 2);
        } catch (e) { /* leave static schema as-is */ }
      }
    })
    .catch(() => {
      select.innerHTML = '<option value="" disabled selected>Unable to load dates — please refresh</option>';
    });
})();

// --- Form Submission & Validation ---
const form = document.getElementById('registerForm');
const formSuccess = document.getElementById('formSuccess');
const submitBtn = document.getElementById('submitBtn');

if (form) {
  // Live region so screen readers hear submission status.
  let statusRegion = document.getElementById('formStatus');
  if (!statusRegion) {
    statusRegion = document.createElement('div');
    statusRegion.id = 'formStatus';
    statusRegion.className = 'sr-only';
    statusRegion.setAttribute('role', 'status');
    statusRegion.setAttribute('aria-live', 'polite');
    form.appendChild(statusRegion);
  }
  const announce = (msg) => { statusRegion.textContent = msg; };

  // Show/clear a visible, accessible inline error for a field.
  const setFieldError = (el, isValid) => {
    if (el.type === 'checkbox') return; // consent uses its own container styling
    const container = el.closest('.form-group') || el.parentElement;
    if (!container) return;
    let msg = container.querySelector('.field-error');
    if (!isValid) {
      if (!msg) {
        msg = document.createElement('p');
        msg.className = 'field-error';
        msg.id = (el.id || el.name || 'field') + '-error';
        container.appendChild(msg);
        const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
        if (!ids.includes(msg.id)) { ids.push(msg.id); el.setAttribute('aria-describedby', ids.join(' ')); }
      }
      msg.textContent = el.validationMessage || 'Please check this field.';
    } else if (msg) {
      msg.remove();
    }
  };

  const syncAria = (el) => {
    if (el.checkValidity) {
      const isValid = el.checkValidity();
      el.setAttribute('aria-invalid', isValid ? 'false' : 'true');
      el.classList.toggle('error', !isValid);
      setFieldError(el, isValid);

      if (el.id === 'consent') {
        el.closest('.form-consent').classList.toggle('has-error', !isValid);
      }
    }
  };

  form.addEventListener('blur', (e) => {
    if (e.target.matches('input, select, textarea')) {
      syncAria(e.target);
    }
  }, true);

  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid')) {
      syncAria(e.target);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const inputs = form.querySelectorAll('input, select');
    let firstInvalid = null;
    
    inputs.forEach(input => {
      syncAria(input);
      if (!input.checkValidity() && !firstInvalid) {
        firstInvalid = input;
      }
    });

    if (!form.checkValidity()) {
      announce('Please correct the highlighted fields and try again.');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Turnstile Check
    const turnstileResponse = form.querySelector('[name="cf-turnstile-response"]');
    if (turnstileResponse && !turnstileResponse.value) {
      announce('Please complete the security check.');
      alert("Please complete the security check.");
      return;
    }

    // Loading state
    submitBtn.disabled = true;
    announce('Submitting your registration…');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.2"/><path d="M21 12a9 9 0 00-9-9"/></svg> Registering...';

    // Generate a unique event ID for Meta CAPI deduplication
    const eventId = 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Get Meta Cookies if they exist
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
    };

    const payload = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email') ? document.getElementById('email').value.trim() : '',
      phone: document.getElementById('phone') ? document.getElementById('phone').value.trim() : '',
      webinarDate: document.getElementById('webinarDate') ? document.getElementById('webinarDate').value : '',
      yearsService: document.getElementById('yearsService') ? document.getElementById('yearsService').value : '',
      topic: document.getElementById('topic') ? document.getElementById('topic').value : '',
      agency: document.getElementById('agency') ? document.getElementById('agency').value : 'Federal',
      marketingConsent: document.getElementById('consent') ? document.getElementById('consent').checked : false,
      // Meta CAPI data
      eventId: eventId,
      clientUserAgent: navigator.userAgent,
      eventSourceUrl: window.location.href,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
      turnstileToken: turnstileResponse ? turnstileResponse.value : null
    };

    fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Show success state
        form.style.display = 'none';
        formSuccess.style.display = 'flex';
        formSuccess.style.flexDirection = 'column';
        announce('Success! You are registered. Check your email for confirmation.');
        // Move focus to the confirmation so keyboard/AT users land on it.
        const successHeading = formSuccess.querySelector('h3');
        if (successHeading) { successHeading.setAttribute('tabindex', '-1'); successHeading.focus(); }

        // Fire a single browser-side Lead only after confirmed success, using
        // the same eventId as the server CAPI event so Meta deduplicates them.
        if (typeof fbq === 'function') {
          fbq('track', 'Lead', {
            content_name: 'Webinar Registration',
            content_category: payload.agency === 'USPS' ? 'USPS' : 'Federal'
          }, { eventID: eventId });
          fbq('track', 'CompleteRegistration', {
            content_name: payload.agency === 'USPS' ? 'USPS Benefits Webinar' : 'Federal Benefits Webinar',
            currency: 'USD',
            value: 0
          });
        }
      } else {
        const msg = data.error || 'An error occurred during registration. Please check your details and try again.';
        announce(msg);
        alert(msg);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    })
    .catch(err => {
      console.error('Registration error:', err);
      announce('Network error. Please try again later.');
      alert('Network error. Please try again later.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    });
  });
}

// --- Contact Form Submission & Validation ---
const contactForm = document.getElementById('contactForm');
const contactFormSuccess = document.getElementById('contactFormSuccess');
const contactSubmitBtn = document.getElementById('contactSubmitBtn');

if (contactForm) {
  const syncContactAria = (el) => {
    if (el.checkValidity) {
      const isValid = el.checkValidity();
      el.setAttribute('aria-invalid', isValid ? 'false' : 'true');
      el.classList.toggle('error', !isValid);
    }
  };

  contactForm.addEventListener('blur', (e) => {
    if (e.target.matches('input, textarea')) {
      syncContactAria(e.target);
    }
  }, true);

  contactForm.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid')) {
      syncContactAria(e.target);
    }
  });

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const inputs = contactForm.querySelectorAll('input, textarea');
    let firstInvalid = null;

    inputs.forEach(input => {
      syncContactAria(input);
      if (!input.checkValidity() && !firstInvalid) {
        firstInvalid = input;
      }
    });

    if (!contactForm.checkValidity()) {
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const turnstileResponse = contactForm.querySelector('[name="cf-turnstile-response"]');
    if (turnstileResponse && !turnstileResponse.value) {
      alert('Please complete the security check.');
      return;
    }

    contactSubmitBtn.disabled = true;
    const originalBtnHTML = contactSubmitBtn.innerHTML;
    contactSubmitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.2"/><path d="M21 12a9 9 0 00-9-9"/></svg> Sending...';

    const payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      message: document.getElementById('message').value.trim(),
      turnstileToken: turnstileResponse ? turnstileResponse.value : null
    };

    fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        contactForm.style.display = 'none';
        contactFormSuccess.style.display = 'flex';
        contactFormSuccess.style.flexDirection = 'column';
      } else {
        alert(data.error || 'An error occurred while sending your message. Please try again.');
        contactSubmitBtn.disabled = false;
        contactSubmitBtn.innerHTML = originalBtnHTML;
      }
    })
    .catch(err => {
      console.error('Contact form error:', err);
      alert('Network error. Please try again later.');
      contactSubmitBtn.disabled = false;
      contactSubmitBtn.innerHTML = originalBtnHTML;
    });
  });
}

// Copy link helper
function copyLink(btn) {
  const targetBtn = btn || (typeof event !== 'undefined' ? event.target : null);
  navigator.clipboard.writeText(window.location.href).then(() => {
    if (targetBtn) {
      const buttonEl = targetBtn.closest ? targetBtn.closest('button') : targetBtn;
      const orig = buttonEl.innerHTML;
      buttonEl.innerHTML = '✓ Copied!';
      setTimeout(() => { buttonEl.innerHTML = orig; }, 2000);
    }
  }).catch(err => {
    console.error('Failed to copy link:', err);
  });
}

// Spin animation for loading
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);

// --- Dark Mode Switcher ---
(function () {
  const root = document.documentElement;
  const toggles = document.querySelectorAll('.theme-toggle');
  
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  
  root.setAttribute('data-theme', currentTheme);
  
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', currentTheme);
      localStorage.setItem('theme', currentTheme);
    });
  });
})();

// --- Blog Category Filtering ---
(function() {
  const filterContainer = document.getElementById('blogCategoryFilter');
  if (!filterContainer) return;

  const filterLinks = filterContainer.querySelectorAll('.sidebar-nav-item');
  const blogCards = document.querySelectorAll('.blog-card');

  filterLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update active state
      filterLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const filterValue = link.getAttribute('data-filter');

      // Filter cards
      blogCards.forEach(card => {
        if (filterValue === 'all') {
          card.style.display = 'flex'; // blog-card uses flex
        } else {
          if (card.getAttribute('data-category') === filterValue) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });
})();
/* --- FAQ Sidebar Navigation --- */
const faqNavItems = document.querySelectorAll('.faq-nav-item');
const faqCategories = document.querySelectorAll('.faq-category');

if (faqNavItems.length > 0 && faqCategories.length > 0) {
  window.addEventListener('scroll', () => {
    let current = '';
    
    faqCategories.forEach(category => {
      const sectionTop = category.offsetTop;
      const sectionHeight = category.clientHeight;
      // Adjust offset based on header height (approx 80px) + some buffer
      if (pageYOffset >= (sectionTop - 120)) {
        current = category.getAttribute('id');
      }
    });

    faqNavItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href').includes('#' + current)) {
        item.classList.add('active');
      }
    });
  });

  // Smooth scroll for FAQ sidebar items
  faqNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 90,
          behavior: 'smooth'
        });
        
        // Update URL hash without jumping
        history.pushState(null, null, targetId);
      }
    });
  });
}
