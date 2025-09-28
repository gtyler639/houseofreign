// ===== Countdown Timer =====
class CountdownTimer {
  constructor(targetDate, { onEnd } = {}) {
    this.targetDate = new Date(targetDate).getTime();
    this.onEnd = onEnd;
    this.elements = {
      days: document.getElementById('days'),
      hours: document.getElementById('hours'),
      minutes: document.getElementById('minutes'),
      seconds: document.getElementById('seconds')
    };
    if (Object.values(this.elements).every(Boolean)) {
      this.start();
    }
  }

  start() {
    this.updateTimer();
    this.intervalId = setInterval(() => this.updateTimer(), 1000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  updateTimer() {
    const now = Date.now();
    const distance = this.targetDate - now;

    if (distance <= 0) {
      this.stop();
      this.setAll("00","00","00","00");
      if (typeof this.onEnd === 'function') this.onEnd();
      return;
    }

    const days = Math.floor(distance / 86_400_000);
    const hours = Math.floor((distance % 86_400_000) / 3_600_000);
    const minutes = Math.floor((distance % 3_600_000) / 60_000);
    const seconds = Math.floor((distance % 60_000) / 1_000);

    this.elements.days.textContent = this.padZero(days);
    this.elements.hours.textContent = this.padZero(hours);
    this.elements.minutes.textContent = this.padZero(minutes);
    this.elements.seconds.textContent = this.padZero(seconds);
  }

  setAll(d,h,m,s){
    this.elements.days.textContent = d;
    this.elements.hours.textContent = h;
    this.elements.minutes.textContent = m;
    this.elements.seconds.textContent = s;
  }

  padZero(num) {
    return String(num).padStart(2, '0');
  }
}

// ===== Form Handling =====
class SubscriptionForm {
  constructor() {
    this.form = document.getElementById('subscriptionForm');
    if (!this.form) return;

    this.emailInput = document.getElementById('email');
    this.phoneInput = document.getElementById('phone');

    this.liveRegion = document.createElement('div');
    this.liveRegion.className = 'form-message';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.style.marginTop = '10px';
    this.form.appendChild(this.liveRegion);

    this.init();
  }

  init() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    if (this.phoneInput) {
      this.phoneInput.addEventListener('input', (e) => {
        // keep only digits
        e.target.value = e.target.value.replace(/\D/g, '');
      });
    }
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !!email && emailRegex.test(email);
  }

  showMessage(message, isError = false) {
    this.liveRegion.textContent = message;
    this.liveRegion.style.padding = '10px';
    this.liveRegion.style.borderRadius = '5px';
    this.liveRegion.style.fontSize = '14px';
    this.liveRegion.style.textAlign = 'center';
    this.liveRegion.style.border = isError ? '1px solid #fcc' : '1px solid #cfc';
    this.liveRegion.style.background = isError ? '#fee' : '#efe';
    this.liveRegion.style.color = isError ? '#c33' : '#363';

    if (!isError) {
      clearTimeout(this._msgTimer);
      this._msgTimer = setTimeout(() => { this.liveRegion.textContent = ''; }, 5000);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    const email = (this.emailInput?.value || '').trim();
    const phone = (this.phoneInput?.value || '').trim();

    if (!email && !phone) {
      this.showMessage('Please enter either your email address or phone number.', true);
      return;
    }
    if (email && !this.validateEmail(email)) {
      this.showMessage('Please enter a valid email address.', true);
      return;
    }

    const submitBtn = this.form.querySelector('.subscribe-btn');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.textContent = 'SUBSCRIBING...';
      submitBtn.disabled = true;
    }

    try {
      await this.submitToAPI(email || null, phone || null);
      const method = email ? 'email' : 'phone';
      this.showMessage(`Successfully subscribed! You'll receive updates via ${method}.`);
      this.form.reset();
    } catch (err) {
      console.error('Subscription error:', err);
      this.showMessage(err?.message || 'Sorry, there was an error. Please try again later.', true);
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  async submitToAPI(email, phone) {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, phone })
    });

    let data = null;
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || `Subscription failed (${res.status})`;
      throw new Error(msg);
    }
    return data || { ok: true };
  }
}

// ===== Smooth Animations =====
class SmoothAnimations {
  constructor() {
    this.prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
  }

  init() {
    document.documentElement.style.scrollBehavior = this.prefersReduced ? 'auto' : 'smooth';
    this.animateOnLoad();
    this.setupScrollAnimations();
    this.setupHover();
  }

  animateOnLoad() {
    if (this.prefersReduced) return;
    const elements = document.querySelectorAll('.main-content > *');
    elements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * 100);
    });
  }

  setupScrollAnimations() {
    if (this.prefersReduced) return;
    const revealables = document.querySelectorAll('[data-reveal]');
    if (!revealables.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    revealables.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      io.observe(el);
    });
  }

  setupHover() {
    const mannequins = document.querySelectorAll('.mannequin');
    mannequins.forEach((m) => {
      m.style.transition = 'transform 0.3s ease';
      m.addEventListener('mouseenter', () => { m.style.transform = 'scale(1.05)'; });
      m.addEventListener('mouseleave', () => { m.style.transform = 'scale(1)'; });
    });
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  const targetISO = '2025-12-04T00:00:00-05:00';
  new CountdownTimer(targetISO);
  new SubscriptionForm();
  new SmoothAnimations();

  // Ripple effect
  const subscribeBtn = document.querySelector('.subscribe-btn');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', (e) => {
      if (subscribeBtn.disabled) return;
      const rect = subscribeBtn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;
        left:${x}px;top:${y}px;background:rgba(255,255,255,0.3);
        border-radius:50%;transform:scale(0);animation:ripple 0.6s linear;
        pointer-events:none;
      `;
      subscribeBtn.style.position = 'relative';
      subscribeBtn.style.overflow = 'hidden';
      subscribeBtn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
    if (!document.getElementById('ripple-anim-style')) {
      const style = document.createElement('style');
      style.id = 'ripple-anim-style';
      style.textContent = `@keyframes ripple{to{transform:scale(4);opacity:0}}`;
      document.head.appendChild(style);
    }
  }
});
