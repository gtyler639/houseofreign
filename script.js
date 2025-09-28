// Countdown Timer Functionality
class CountdownTimer {
    constructor(targetDate) {
        this.targetDate = new Date(targetDate).getTime();
        this.elements = {
            days: document.getElementById('days'),
            hours: document.getElementById('hours'),
            minutes: document.getElementById('minutes'),
            seconds: document.getElementById('seconds')
        };
        this.start();
    }

    start() {
        this.updateTimer();
        setInterval(() => this.updateTimer(), 1000);
    }

    updateTimer() {
        const now = new Date().getTime();
        const distance = this.targetDate - now;

        if (distance < 0) {
            // Countdown finished
            this.elements.days.textContent = '00';
            this.elements.hours.textContent = '00';
            this.elements.minutes.textContent = '00';
            this.elements.seconds.textContent = '00';
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        this.elements.days.textContent = this.padZero(days);
        this.elements.hours.textContent = this.padZero(hours);
        this.elements.minutes.textContent = this.padZero(minutes);
        this.elements.seconds.textContent = this.padZero(seconds);
    }

    padZero(num) {
        return num.toString().padStart(2, '0');
    }
}

// Form Handling
class SubscriptionForm {
    constructor() {
        this.form = document.getElementById('subscriptionForm');
        this.emailInput = document.getElementById('email');
        this.phoneInput = document.getElementById('phone');
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.setupPhoneValidation();
    }

    setupPhoneValidation() {
        this.phoneInput.addEventListener('input', (e) => {
            // Remove any non-digit characters
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePhone(phone) {
        // US phone number validation (10 digits)
        const phoneRegex = /^\d{10}$/;
        return phoneRegex.test(phone);
    }

    showMessage(message, isError = false) {
        // Remove existing messages
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${isError ? 'error' : 'success'}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            margin-top: 10px;
            padding: 10px;
            border-radius: 5px;
            font-size: 14px;
            text-align: center;
            ${isError ? 'background: #fee; color: #c33; border: 1px solid #fcc;' : 'background: #efe; color: #363; border: 1px solid #cfc;'}
        `;

        this.form.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    async handleSubmit(e) {
        e.preventDefault();

        const email = this.emailInput.value.trim();
        const phone = this.phoneInput.value.trim();

        // Validation - require either email OR phone
        if (!email && !phone) {
            this.showMessage('Please enter either your email address or phone number.', true);
            return;
        }

        if (email && !this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address.', true);
            return;
        }

        if (phone && !this.validatePhone(phone)) {
            this.showMessage('Please enter a valid 10-digit phone number.', true);
            return;
        }

        // Show loading state
        const submitBtn = this.form.querySelector('.subscribe-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'SUBSCRIBING...';
        submitBtn.disabled = true;

        try {
            // Simulate API call (replace with actual endpoint)
            await this.submitToAPI(email, phone);
            const contactMethod = email ? 'email' : 'SMS';
            this.showMessage(`Successfully subscribed! You'll receive updates about our upcoming drop via ${contactMethod}.`);
            this.form.reset();
        } catch (error) {
            console.error('Subscription error:', error);
            this.showMessage('Sorry, there was an error. Please try again later.', true);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async submitToAPI(email, phone) {
        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, phone })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Subscription failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
}

// Smooth scrolling and animations
class SmoothAnimations {
    constructor() {
        this.init();
    }

    init() {
        // Add smooth scroll behavior
        document.documentElement.style.scrollBehavior = 'smooth';

        // Add entrance animations
        this.animateOnLoad();
        this.setupScrollAnimations();
    }

    animateOnLoad() {
        const elements = document.querySelectorAll('.main-content > *');
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    setupScrollAnimations() {
        // Add subtle hover effects
        const mannequins = document.querySelectorAll('.mannequin');
        mannequins.forEach(mannequin => {
            mannequin.addEventListener('mouseenter', () => {
                mannequin.style.transform = 'scale(1.05)';
                mannequin.style.transition = 'transform 0.3s ease';
            });

            mannequin.addEventListener('mouseleave', () => {
                mannequin.style.transform = 'scale(1)';
            });
        });
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set fixed target date: December 4, 2025
    const targetDate = new Date('December 4, 2025');
    
    // Initialize countdown timer
    new CountdownTimer(targetDate);
    
    // Initialize subscription form
    new SubscriptionForm();
    
    // Initialize animations
    new SmoothAnimations();
});

// Add some interactive features
document.addEventListener('DOMContentLoaded', () => {
    // Add click effect to subscribe button
    const subscribeBtn = document.querySelector('.subscribe-btn');
    subscribeBtn.addEventListener('click', (e) => {
        // Create ripple effect
        const ripple = document.createElement('span');
        const rect = e.target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;
        
        e.target.style.position = 'relative';
        e.target.style.overflow = 'hidden';
        e.target.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    });
    
    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});
