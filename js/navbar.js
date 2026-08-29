// js/navbar.js

const navLinks = [
    { href: 'index.html', page: 'home', label: 'Home', icon: 'home' },
    { href: 'create-event.html', page: 'create', label: 'Create', icon: 'plus' },
    { href: 'saved.html', page: 'saved', label: 'Saved', icon: 'bookmark' },
    { href: 'profile.html', page: 'profile', label: 'Profile', icon: 'user' },
];

const icons = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};

function renderNavbar(currentPage = window.location.pathname) {
    const container = document.getElementById('navbar');
    if (!container) return;

    const linksHtml = navLinks.map(link => {
        const isActive = currentPage === '/' || currentPage.endsWith('index.html') 
            ? link.page === 'home' 
            : currentPage.includes(link.href);

        return `
            <a href="${link.href}" class="nav-item ${isActive ? 'active' : ''}" data-page="${link.page}">
                ${icons[link.icon]}
                <span>${link.label}</span>
            </a>
        `;
    }).join('');

    const brandHtml = `
        <div class="nav-brand">
            <img src="assets/kbu-pulse-logo.png" alt="KBU PULSE" class="nav-brand-img">
            <span class="nav-brand-name">KBU PULSE</span>
        </div>
    `;

    container.innerHTML = brandHtml + linksHtml;
}

// Attach to window for global access
window.navbar = { renderNavbar };

// Auto-render when DOM is ready if script isn't deferred
document.addEventListener('DOMContentLoaded', () => {
    renderNavbar(window.location.pathname);
});