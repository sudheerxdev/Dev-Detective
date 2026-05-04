// Smooth navigation
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');

navToggle?.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'slideInUp 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('.landing-section').forEach(section => {
    observer.observe(section);
});

// Active nav link on scroll
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    } else {
        navbar.style.boxShadow = 'none';
    }

    // Update active nav link
    const sections = document.querySelectorAll('.landing-section');
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Parallax effect for hero section
const heroSection = document.querySelector('.section-1');
const heroMascot = document.querySelector('.hero-mascot');

if (heroMascot) {
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        if (scrollY < window.innerHeight) {
            heroMascot.style.transform = `translateY(${scrollY * 0.5}px) scale(${1 - scrollY * 0.0005})`;
        }
    });
}

// Counter animation for metrics
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const counter = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(counter);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Observe metrics
const metricsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
            const strong = entry.target.querySelector('strong');
            if (strong) {
                const text = strong.textContent;
                const num = parseInt(text.replace(/\D/g, ''));
                if (!isNaN(num)) {
                    strong.dataset.target = num;
                    animateCounter(strong, num, 1500);
                    entry.target.dataset.animated = 'true';
                }
            }
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.metric').forEach(metric => {
    metricsObserver.observe(metric);
});

// Progress bar animation
const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
            entry.target.dataset.animated = 'true';
            const fill = entry.target.querySelector('.progress-fill');
            if (fill) {
                const width = fill.style.width;
                fill.style.width = '0';
                setTimeout(() => {
                    fill.style.width = width;
                }, 50);
            }
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.scoring-item').forEach(item => {
    progressObserver.observe(item);
});

// Stagger animation for grid items
const gridObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const children = entry.target.querySelectorAll('.feature-card, .benefit-item, .timeline-item, .insight-box, .report-item, .security-item, .analytics-card');
            children.forEach((child, index) => {
                child.style.animation = `slideInUp 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 100}ms forwards`;
                child.style.opacity = '0';
            });
            gridObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.features-grid, .benefits-grid, .roadmap-timeline, .insights-showcase, .report-features, .security-features, .analytics-showcase').forEach(grid => {
    gridObserver.observe(grid);
});

// Theme toggle (if using)
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Page load animation
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});

// Initial body opacity
document.body.style.opacity = '0';
document.body.style.animation = 'fadeIn 800ms ease forwards';
