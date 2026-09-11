// ========== KBU PULSE - Main Application ==========
// All logic merged into single file for static server compatibility

import { capitalize, formatCategory } from './util.js';
import { groupMembers } from './members.js';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch((error) => {
            console.warn('KBU PULSE service worker registration failed:', error);
        });
    });
}

// ========== CONFIG ==========
const API_BASE_URL = 'https://kbu-pulse-api-1.onrender.com';
const AUTH_KEY = 'kbu_pulse_user';

// ========== UTILITIES ==========
function requireAuth() {
    if (!getUser()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function avatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=ff751f&color=fff`;
}

let lightboxImages = [];
let lightboxIndex = 0;

function openLightbox(images, startIndex = 0) {
    lightboxImages = images;
    lightboxIndex = startIndex;
    renderLightbox();
}

function renderLightbox() {
    let overlay = document.getElementById('lightbox-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.className = 'lightbox-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeLightbox();
            if (e.target.closest('.lightbox-close')) closeLightbox();
            if (e.target.closest('.lightbox-prev')) navigateLightbox(-1);
            if (e.target.closest('.lightbox-next')) navigateLightbox(1);
        });
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <button class="lightbox-close">&times;</button>
        <button class="lightbox-nav lightbox-prev">&#8249;</button>
        <img class="lightbox-img" src="${lightboxImages[lightboxIndex]}" alt="Image ${lightboxIndex + 1}">
        <button class="lightbox-nav lightbox-next">&#8250;</button>
        <div class="lightbox-counter">${lightboxIndex + 1} / ${lightboxImages.length}</div>
    `;
    overlay.classList.add('lightbox-show');
}

function navigateLightbox(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    renderLightbox();
}

function closeLightbox() {
    const overlay = document.getElementById('lightbox-overlay');
    if (overlay) {
        overlay.classList.remove('lightbox-show');
        setTimeout(() => overlay.remove(), 300);
    }
}

document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox-overlay')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
});

function truncate(str, len = 50) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\'\"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[char]);
}

function renderGroupMembers() {
    const container = document.getElementById('group-members');
    if (!container) return;
    container.innerHTML = groupMembers.map((member) => `
        <div class="group-member">
            <img class="group-member-avatar" src="https://i.pravatar.cc/96?img=${member.imageId}" alt="${escapeHtml(member.name)}">
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.id)}</span>
        </div>
    `).join('');
}

// ========== AUTH ==========
function getUser() {
    const str = localStorage.getItem(AUTH_KEY);
    if (!str) return null;
    try {
        return JSON.parse(str);
    } catch {
        localStorage.removeItem(AUTH_KEY);
        return null;
    }
}

function setUser(user) {
    if (!user) {
        clearUser();
        return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearUser() {
    localStorage.removeItem(AUTH_KEY);
}

// ========== API CLIENT ==========
const apiClient = {
    _headers() {
        const user = getUser();
        const headers = { 'Content-Type': 'application/json' };
        if (user) headers['x-user-id'] = user.id;
        return headers;
    },

    async get(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: 'GET',
            headers: this._headers(),
        });
        return this._handle(res);
    },

    async post(path, body) {
        const user = getUser();
        const headers = {};
        if (user) headers['x-user-id'] = user.id;
        const isFormData = body instanceof FormData;
        if (!isFormData) headers['Content-Type'] = 'application/json';
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers,
            body: isFormData ? body : JSON.stringify(body),
        });
        return this._handle(res);
    },

    async patch(path, body) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: 'PATCH',
            headers: this._headers(),
            body: JSON.stringify(body),
        });
        return this._handle(res);
    },

    async delete(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: 'DELETE',
            headers: this._headers(),
        });
        return this._handle(res);
    },

    async _handle(res) {
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }
        return res.json();
    },
};

// ========== RENDER HELPERS ==========
function renderEventCard(event, { showActions = false, isOwner = false } = {}) {
    const actions =
        isOwner
            ? `
        <div class="card-actions">
            <button class="btn-icon edit-btn" data-event-id="${event.id}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
            <button class="btn-icon delete-btn" data-event-id="${event.id}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg></button>
        </div>
    `
            : showActions
            ? `
        <div class="card-actions">
            <button class="btn-icon upvote-btn${event.hasUpvoted ? ' active' : ''}" data-event-id="${event.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span>${event.upvoteCount || 0}</span></button>
            <button class="btn-icon save-btn${event.hasSaved ? ' active' : ''}" data-event-id="${event.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
            <button class="btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>${event.commentCount || 0}</span></button>
        </div>
    `
            : '';

    return `
        <div class="event-card" data-event-id="${event.id}">
            <div class="event-card-media">
                ${
                    event.imageUrls && event.imageUrls.length > 0
                        ? `<img class="event-card-img" src="${event.imageUrls[0]}" alt="${event.title}">`
                        : `<img class="event-card-img" src="assets/kbu.webp" alt="${event.title}">`
                }
                <span class="category-badge">${formatCategory(event.category)}</span>
            </div>
            <h3 class="event-card-title" style="font-size: 1rem; margin: 0.5rem 0;">${escapeHtml(event.title)}</h3>
            <p class="event-card-desc" style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">${escapeHtml(truncate(event.description, 80))}</p>
            ${actions}
        </div>
    `;
}


function renderCommentCard(comment, { ownerOverride = false } = {}) {
    const author = comment.author || {};
    const currentUser = getUser();
    const isOwner = currentUser && (ownerOverride || author.id === currentUser.id || comment.userId === currentUser.id || comment.authorId === currentUser.id);
    const commentId = comment.id;
    return `
        <div class="comment-card">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <img src="${author.avatarUrl || avatarUrl(author.fullName)}" alt="${author.fullName}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                <span style="font-size: 0.8rem; font-weight: 600;">${escapeHtml(author.fullName || 'Unknown')}</span>
                <span class="text-muted" style="font-size: 0.7rem;">${formatDate(comment.createdAt)}</span>
                ${isOwner ? `<span class="comment-owner-actions"><button class="btn btn-xs btn-secondary delete-comment-btn" data-comment-id="${commentId}">Delete</button></span>` : ''}
            </div>
            <p class="comment-content" style="font-size: 0.875rem; margin: 0.25rem 0;">${escapeHtml(comment.content)}</p>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                <button class="btn-icon like-btn${comment.hasLiked ? ' active' : ''}" data-comment-id="${commentId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                    <span>${comment.totalLikes || 0}</span>
                </button>
            </div>
        </div>
    `;
}

function renderPagination(total, currentPage) {
    const pages = Math.ceil(total / 20);
    let html = '';
    for (let i = 1; i <= pages; i++) {
        const active = i === currentPage ? 'active' : '';
        html += `<button class="pagination-btn ${active}" data-page="${i}">${i}</button>`;
    }
    return html;
}

function renderSkeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
            <div class="skeleton skeleton-img"></div>
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-meta"></div>
            </div>`;
    }
    return html;
}

// ========== PAGE INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    renderGroupMembers();
    const path = window.location.pathname;

    // Render navbar
    if (window.navbar) window.navbar.renderNavbar(path);

    // Route to page handler.
    // Matches by keyword so it works under any base path: root ("/"),
    // GitHub Pages ("/repo/"), or extensionless static hosts ("/event-detail").
    const isHome = path === '/' || path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('/index');

    if (isHome) {
        initHomePage();
    } else if (path.includes('event-detail')) {
        initEventDetailPage();
    } else if (path.includes('edit-event')) {
        initEditEventPage();
    } else if (path.includes('create-event')) {
        initCreateEventPage();
    } else if (path.includes('saved')) {
        console.log('Initializing saved events page');
        initSavedEventsPage(); // Reuse profile page logic for saved events
    } else if (path.includes('profile')) {
        console.log('Initializing profile page');
        initProfilePage();
    } else if (path.includes('forgot-password')) {
        initForgotPasswordPage();
    } else if (path.includes('reset-password')) {
        initResetPasswordPage();
    } else if (path.includes('register')) {
        initRegisterPage();
    } else if (path.includes('login')) {
        initLoginPage();
    } else {
        initHomePage(); // Unknown path -> default to home
    }
});

// ========== URL SYNC ==========
function syncUrl(category, major, search, sort, page) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (major) params.set('major', major);
    if (search) params.set('q', search);
    if (sort && sort !== 'newest') params.set('sort', sort);
    if (page && page > 1) params.set('page', page.toString());
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    history.replaceState(null, '', url);
}

// ========== PAGE HANDLERS ==========

async function initHomePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const major = urlParams.get('major');
    const sort = urlParams.get('sort');
    const search = urlParams.get('q');

    const categoryEl = document.getElementById('category-filter');
    const majorEl = document.getElementById('major-filter');
    const sortEl = document.getElementById('sort-filter');
    const searchEl = document.getElementById('search-input');

    if (categoryEl && category) categoryEl.value = category;
    if (majorEl && major) majorEl.value = major;
    if (sortEl && sort) sortEl.value = sort;
    if (searchEl && search) searchEl.value = search;

    await loadEvents(1, category || null, major || null, search || '', sort || null);
    syncUrl(category, major, search, sort, 1);

    function applyFilters() {
        const cat = categoryEl?.value || '';
        const maj = majorEl?.value || '';
        const srt = sortEl?.value || '';
        const q = searchEl?.value || '';
        syncUrl(cat || null, maj || null, q, srt || null, 1);
        loadEvents(1, cat || null, maj || null, q, srt || null);
    }

    document.addEventListener('change', (e) => {
        if (e.target.id === 'category-filter' || e.target.id === 'major-filter' || e.target.id === 'sort-filter') {
            applyFilters();
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'search-input') {
            applyFilters();
        }
    });
}

function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.elements.email.value.trim();
        const password = e.target.elements.password.value.trim();

        try {
            const data = await apiClient.post('/api/auth/login', { email, password });
            console.log('Login response:', data);
            setUser(data.data);
            showToast('Login successful!', 'success');
            window.location.href = 'index.html';
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function initRegisterPage() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const registerCard = document.getElementById('register-card');
    const otpStep = document.getElementById('otp-step');
    const otpForm = document.getElementById('otp-form');
    const otpEmailEl = document.getElementById('otp-email');
    const otpHint = document.getElementById('otp-hint');
    const otpDisplay = document.getElementById('otp-display');
    const backToForm = document.getElementById('back-to-form');

    let pendingEmail = '';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = e.target.elements.fullName.value.trim();
        const email = e.target.elements.email.value.trim();
        const major = e.target.elements.major.value;
        const password = e.target.elements.password.value;
        const confirmPassword = e.target.elements.confirmPassword.value;

        if (!major) {
            showToast('Please select a major', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        try {
            const data = await apiClient.post('/api/auth/register', {
                fullName,
                email,
                major,
                password,
            });
            const payload = data?.data ?? data;
            pendingEmail = email;
            otpEmailEl.textContent = email;
            if (payload?.otpCode) {
                otpDisplay.textContent = payload.otpCode;
                otpHint.hidden = false;
            }
            registerCard.hidden = true;
            otpStep.hidden = false;
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = e.target.elements.code.value.trim();

        if (code.length !== 6) {
            showToast('Enter the 6-digit code', 'error');
            return;
        }

        try {
            const data = await apiClient.post('/api/auth/verify-registration', {
                email: pendingEmail,
                code,
            });
            const user = data?.data ?? data;
            setUser(user);
            showToast('Registration successful!', 'success');
            window.location.href = 'index.html';
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    if (backToForm) {
        backToForm.addEventListener('click', (e) => {
            e.preventDefault();
            registerCard.hidden = false;
            otpStep.hidden = true;
            otpHint.hidden = true;
            if (otpForm.elements.code) otpForm.elements.code.value = '';
        });
    }
}

const RESET_EMAIL_KEY = 'kbu_pulse_reset_email';
const RESET_CODE_KEY = 'kbu_pulse_reset_code';

function initForgotPasswordPage() {
    const form = document.getElementById('forgot-form');
    if (!form) return;

    const otpHint = document.getElementById('otp-hint');
    const otpDisplay = document.getElementById('otp-display');
    const continueReset = document.getElementById('continue-reset');
    const sendButton = form.querySelector('.btn-primary');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.elements.email.value.trim();

        try {
            const data = await apiClient.post('/api/auth/forgot-password', { email });
            const payload = data?.data ?? data;
            sessionStorage.setItem(RESET_EMAIL_KEY, email);

            if (payload?.otpCode) {
                sessionStorage.setItem(RESET_CODE_KEY, payload.otpCode);
                otpDisplay.textContent = payload.otpCode;
                otpHint.classList.remove('is-hidden');
                continueReset.classList.remove('is-hidden');
                if (sendButton) sendButton.classList.add('is-hidden');
                showToast(payload?.message || 'Reset code sent!', 'success');
            } else {
                showToast(payload?.message || 'Reset code sent!', 'success');
                window.location.href = 'reset-password.html';
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    if (continueReset) {
        continueReset.addEventListener('click', () => {
            window.location.href = 'reset-password.html';
        });
    }
}

function initResetPasswordPage() {
    const form = document.getElementById('reset-form');
    if (!form) return;

    const emailEl = form.elements.email;
    if (emailEl) emailEl.value = sessionStorage.getItem(RESET_EMAIL_KEY) || '';
    const codeEl = form.elements.code;
    if (codeEl) codeEl.value = sessionStorage.getItem(RESET_CODE_KEY) || '';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.elements.email.value.trim();
        const code = e.target.elements.code.value.trim();
        const password = e.target.elements.password.value;
        const confirmPassword = e.target.elements.confirmPassword.value;

        if (code.length !== 6) {
            showToast('Enter the 6-digit code', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        try {
            await apiClient.post('/api/auth/reset-password', {
                email,
                code,
                newPassword: password,
            });
            sessionStorage.removeItem(RESET_EMAIL_KEY);
            sessionStorage.removeItem(RESET_CODE_KEY);
            showToast('Password reset! Please log in.', 'success');
            window.location.href = 'login.html';
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

async function initEventDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        showToast('Event not found', 'error');
        window.location.href = 'index.html';
        return;
    }

    const headerEl = document.getElementById('event-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <div class="skeleton skeleton-title" style="height: 1.5rem; width: 70%;"></div>
            <div class="skeleton skeleton-text" style="height: 0.75rem; width: 100%; margin-top: 0.75rem;"></div>
            <div class="skeleton skeleton-text" style="height: 0.75rem; width: 60%; margin-top: 0.5rem;"></div>
            <div class="skeleton skeleton-img" style="height: 240px; margin-top: 1rem; border-radius: 8px;"></div>
            <div class="skeleton skeleton-text" style="height: 0.75rem; width: 40%; margin-top: 0.75rem;"></div>
        `;
    }

    try {
        const res = await apiClient.get(`/api/events/${eventId}`);
       
        const event = res.data;

        const header = document.getElementById('event-header');
        if (!header) return;

        const creatorMeta = event.creator?.major || '';

        header.innerHTML = `
            <div class="event-detail-kicker">${formatCategory(event.category)}</div>
            <h1 class="event-detail-title">${event.title}</h1>
            <div class="event-meta">
                ${event.major ? `<span class="meta-badge meta-major">${event.major}</span>` : ''}
                <span class="meta-badge meta-date">${formatDate(event.createdAt)}</span>
                <span class="event-detail-views">${event.viewCount || 0} views</span>
            </div>
            <p class="event-detail-description">${event.description}</p>
            ${
                event.imageUrls && event.imageUrls.length > 0
                    ? `<div class="event-images-grid event-detail-gallery">${event.imageUrls.map((url, i) => `<img class="event-card-img" src="${url}" alt="${event.title} ${i + 1}" data-image-index="${i}" style="cursor: pointer;">`).join('')}</div>`
                    : `<div class="event-detail-gallery event-detail-gallery-empty"><img class="event-card-img" src="assets/kbu.webp" alt="${event.title}"></div>`
            }
            <div class="event-detail-creator">
                <img src="${event.creator?.avatarUrl || avatarUrl(event.creator?.fullName)}" alt="${event.creator?.fullName || 'Unknown'}" class="event-detail-avatar">
                <div class="event-detail-creator-info">
                    <span class="event-detail-creator-name">${event.creator?.fullName || 'Unknown'}</span>
                    <span class="event-detail-creator-meta">${creatorMeta}</span>
                </div>
            </div>
        `;

        const imageGrid = header.querySelector('.event-images-grid');
        if (imageGrid) {
            imageGrid.addEventListener('click', (e) => {
                const img = e.target.closest('img[data-image-index]');
                if (img) openLightbox(event.imageUrls, parseInt(img.dataset.imageIndex));
            });
        }

        const commentCountEl = document.getElementById('comment-count');
        if (commentCountEl && event.commentCount) commentCountEl.textContent = `(${event.commentCount})`;

        const eventActions = document.querySelector('.event-actions');
        if (eventActions) eventActions.style.display = 'block';

        const upvoteBtn = document.querySelector('.upvote-btn');
        if (upvoteBtn) {
            upvoteBtn.dataset.eventId = eventId;
            if (event.hasUpvoted) upvoteBtn.classList.add('active');
            const upvoteText = upvoteBtn.querySelector('.upvote-text');
            if (upvoteText) upvoteText.textContent = `Upvotes (${event.upvoteCount || 0})`;
            upvoteBtn.addEventListener('click', async () => {
                if (!requireAuth()) return;
                upvoteBtn.disabled = true;
                try {
                    const res = await apiClient.post(`/api/events/${eventId}/upvote`);
                    upvoteBtn.classList.toggle('active', res.data.hasUpvoted);
                    const upvoteText = upvoteBtn.querySelector('.upvote-text');
                    if (upvoteText) upvoteText.textContent = `Upvotes (${res.data.totalUpvotes ?? event.totalUpvotes ?? 0})`;
                    showToast(res.data.hasUpvoted ? 'Upvoted!' : 'Upvote removed', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    upvoteBtn.disabled = false;
                }
            });
        }

        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.dataset.eventId = eventId;
            if (event.hasSaved) saveBtn.classList.add('active');
            const saveText = saveBtn.querySelector('.save-text');
            if (saveText) saveText.textContent = event.hasSaved ? 'Unsave' : 'Save';
            saveBtn.addEventListener('click', async () => {
                if (!requireAuth()) return;
                saveBtn.disabled = true;
                try {
                    const res = await apiClient.post(`/api/events/${eventId}/save`);
                    saveBtn.classList.toggle('active', res.data.isSaved);
                    const saveText = saveBtn.querySelector('.save-text');
                    if (saveText) saveText.textContent = res.data.isSaved ? 'Unsave' : 'Save';
                    showToast(res.data.isSaved ? 'Saved!' : 'Unsaved', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    saveBtn.disabled = false;
                }
            });
        }

        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                const url = window.location.href.split('#')[0];
                try {
                    await navigator.clipboard.writeText(url);
                    showToast('Link copied to clipboard', 'success');
                } catch {
                    showToast('Could not copy link', 'error');
                }
            });
        }
    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('event-header').innerHTML =
            '<p class="text-error">Failed to load event</p>';
    }

    try {
        await loadComments(eventId, 1);
    } catch (err) {
        showToast(err.message, 'error');
    }

    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!requireAuth()) return;
            const content = e.target.elements.content?.value?.trim();
            if (!content) return;

            try {
                await apiClient.post(`/api/events/${eventId}/comments`, { content });
                showToast('Comment posted!', 'success');
                loadComments(eventId, 1);
                e.target.reset();
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
        commentForm.style.display = 'block';
    }
}

function initProfilePage() {
    const user = getUser();
    const guestSection = document.getElementById('profile-guest');
    const contentSection = document.getElementById('profile-content');

    if (!user) {
        if (guestSection) guestSection.style.display = 'block';
        if (contentSection) contentSection.style.display = 'none';
        return;
    }

    if (guestSection) guestSection.style.display = 'none';
    if (contentSection) contentSection.style.display = 'block';

    loadProfile();
    const params = new URLSearchParams(window.location.search);
    const selectTab = (tab) => {
        const active = tab === 'comments' ? 'comments' : 'events';
        document.querySelectorAll('[data-profile-tab]').forEach((button) => {
            const selected = button.dataset.profileTab === active;
            button.classList.toggle('tab-active', selected);
            button.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
        document.getElementById('my-events-section')?.classList.toggle('active', active === 'events');
        document.getElementById('my-comments-section')?.classList.toggle('active', active === 'comments');
        history.replaceState(null, '', `${window.location.pathname}?tab=${active}`);
        if (active === 'events') loadMyEvents();
        else loadMyComments();
    };
    document.querySelectorAll('[data-profile-tab]').forEach((button) => {
        button.addEventListener('click', () => selectTab(button.dataset.profileTab));
    });
    selectTab(params.get('tab'));

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        clearUser();
        window.location.href = 'index.html';
    });
}

function bindEventOwnerActions(container, reload) {
    container.querySelectorAll('.edit-btn').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            window.location.href = `edit-event.html?id=${encodeURIComponent(button.dataset.eventId)}`;
        });
    });
    container.querySelectorAll('.delete-btn').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!window.confirm('Delete this event? This cannot be undone.')) return;
            button.disabled = true;
            try {
                await apiClient.delete(`/api/events/${button.dataset.eventId}`);
                showToast('Event deleted', 'success');
                reload();
            } catch (err) {
                button.disabled = false;
                showToast(err.message, 'error');
            }
        });
    });
}

function initSavedEventsPage() {
    const user = getUser();
    const guestSection = document.getElementById('saved-guest');
    const contentSection = document.getElementById('saved-content');

    if (!user) {
        if (guestSection) guestSection.style.display = 'block';
        if (contentSection) contentSection.style.display = 'none';
        return;
    }

    if (guestSection) guestSection.style.display = 'none';
    if (contentSection) contentSection.style.display = 'block';

    loadSavedEvents();
}

function initCreateEventPage() {
    const user = getUser();
    const guessSection = document.getElementById('create-event-guest');
    const contentSection = document.getElementById('create-event-content');

    if (!user) {
        if (guessSection) guessSection.style.display = 'block';
        if (contentSection) contentSection.style.display = 'none';
        return;
    }

    if (guessSection) guessSection.style.display = 'none';
    if (contentSection) contentSection.style.display = 'block';

    const form = document.getElementById('create-event-form');
    const fileInput = document.getElementById('event-images');
    const previewContainer = document.getElementById('image-preview');
    if (!form || !fileInput || !previewContainer) return;

    let selectedFiles = [];

    function renderPreviews() {
        previewContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '\u00d7';
            removeBtn.addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                renderPreviews();
            });
            item.appendChild(img);
            item.appendChild(removeBtn);
            previewContainer.appendChild(item);
        });
    }

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (selectedFiles.length >= 4) {
                showToast('Maximum 4 images allowed', 'error');
                break;
            }
            if (file.size > 10 * 1024 * 1024) {
                showToast(`${file.name} exceeds 10MB limit`, 'error');
                continue;
            }
            if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
                showToast(`${file.name} is not a supported image type`, 'error');
                continue;
            }
            selectedFiles.push(file);
        }
        fileInput.value = '';
        renderPreviews();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = e.target.elements.title.value.trim();
        const description = e.target.elements.description.value.trim();
        const category = e.target.elements.category.value;
        const major = e.target.elements.major.value || undefined;

        if (!title || !description || !category) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            const eventRes = await apiClient.post('/api/events/', { title, description, category, major });
            const eventId = eventRes.data.id;

            if (selectedFiles.length > 0) {
                submitBtn.textContent = 'Uploading images...';
                const formData = new FormData();
                selectedFiles.forEach((file) => formData.append('files', file));
                await apiClient.post(`/api/events/${eventId}/images`, formData);
            }

            showToast('Event created!', 'success');
            window.location.href = 'index.html';
        } catch (err) {
            showToast(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Event';
        }
    });
}

async function initEditEventPage() {
    const user = getUser();
    const guest = document.getElementById('edit-event-guest');
    const content = document.getElementById('edit-event-content');
    if (!user) { if (guest) guest.style.display = 'block'; return; }
    if (content) content.style.display = 'block';
    const eventId = new URLSearchParams(window.location.search).get('id');
    const form = document.getElementById('edit-event-form');
    const existing = document.getElementById('existing-images');
    const input = document.getElementById('event-images');
    const preview = document.getElementById('image-preview');
    const error = document.getElementById('edit-event-error');
    if (!eventId || !form) return;
    let existingUrls = [];
    let selectedFiles = [];
    const renderPreviews = () => {
        preview.innerHTML = selectedFiles.map((file) => `<div class="preview-item"><img src="${URL.createObjectURL(file)}" alt="${escapeHtml(file.name)}"></div>`).join('');
    };
    try {
        const response = await apiClient.get(`/api/events/${eventId}`);
        const event = response.data;
        form.elements.title.value = event.title || '';
        form.elements.description.value = event.description || '';
        form.elements.category.value = event.category || '';
        form.elements.major.value = event.major || '';
        existingUrls = event.imageUrls || [];
        existing.innerHTML = existingUrls.length ? existingUrls.map((url) => `<div class="preview-item"><img src="${url}" alt="Existing event image"></div>`).join('') : '<span class="text-muted">No existing images</span>';
    } catch (err) {
        error.textContent = err.message || 'Failed to load event';
        error.style.display = 'block';
        return;
    }
    input.addEventListener('change', (event) => {
        for (const file of Array.from(event.target.files)) {
            if (existingUrls.length + selectedFiles.length >= 4) { showToast('Maximum 4 images allowed', 'error'); break; }
            if (file.size > 10 * 1024 * 1024) { showToast(`${file.name} exceeds 10MB limit`, 'error'); continue; }
            selectedFiles.push(file);
        }
        input.value = '';
        renderPreviews();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            await apiClient.patch(`/api/events/${eventId}`, { title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), category: form.elements.category.value, major: form.elements.major.value || undefined });
            if (selectedFiles.length) {
                const data = new FormData();
                selectedFiles.forEach((file) => data.append('files', file));
                await apiClient.post(`/api/events/${eventId}/images`, data);
            }
            showToast('Event updated', 'success');
            window.location.href = 'profile.html?tab=events';
        } catch (err) {
            showToast(err.message, 'error');
            submit.disabled = false;
        }
    });
}

// ========== EVENTS ==========
async function loadEvents(page = 1, category = null, major = null, search = '', sort = null) {
    const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
    });
    if (category) params.append('category', category);
    if (major) params.append('major', major);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);

    const container = document.getElementById('event-list');
    const pagination = document.getElementById('pagination');
    if (container) container.innerHTML = renderSkeletonCards(8);

    try {
        const response = await apiClient.get(`/api/events/?${params.toString()}`);
        console.log('Fetched events:', response);

        const events = response.data.data;
        const meta = response.data.meta;

        if (!container) return;

        const hasFilters = category || major || search || (sort && sort !== 'newest');
        if (events.length === 0) {
            if (hasFilters) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                        <p class="text-muted">No events match your filters.</p>
                        <button class="btn btn-primary" id="clear-filters-btn">Clear all filters</button>
                    </div>`;
                document.getElementById('clear-filters-btn').addEventListener('click', () => {
                    document.getElementById('category-filter').value = '';
                    document.getElementById('major-filter').value = '';
                    document.getElementById('sort-filter').value = 'newest';
                    document.getElementById('search-input').value = '';
                    syncUrl(null, null, null, null, 1);
                    loadEvents(1);
                });
            } else {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                        <p class="text-muted">No events found.</p>
                    </div>`;
            }
            pagination.innerHTML = '';
            return;
        }

        // const events20x = Array.from({ length: 20 }, () => events).flat();

        container.innerHTML = events.map((event) => renderEventCard(event, { showActions: true })).join('');

        container.querySelectorAll('.event-card').forEach((card) => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const id = card.dataset.eventId;
                if (id) window.location.href = `event-detail.html?id=${id}`;
            });
        });

        const totalEvents = meta.total;
        pagination.innerHTML = renderPagination(totalEvents, meta.page);

        pagination.querySelectorAll('.pagination-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pageNum = parseInt(btn.dataset.page, 10);
                loadEvents(pageNum, category, major, search, sort);
            });
        });

        syncUrl(category, major, search, sort, page);

        // Attach upvote/save listeners
        document.querySelectorAll('.upvote-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!requireAuth()) return;
                btn.disabled = true;
                const eventId = btn.dataset.eventId;
                try {
                    const res = await apiClient.post(`/api/events/${eventId}/upvote`);
                    btn.classList.toggle('active', res.data.hasUpvoted);
                    const countEl = btn.querySelector('span');
                    if (countEl) countEl.textContent = res.data.totalUpvotes ?? countEl.textContent;
                    showToast(res.data.hasUpvoted ? 'Upvoted!' : 'Upvote removed', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        document.querySelectorAll('.save-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!requireAuth()) return;
                btn.disabled = true;
                const eventId = btn.dataset.eventId;
                try {
                    const res = await apiClient.post(`/api/events/${eventId}/save`);
                    btn.classList.toggle('active', res.data.isSaved);
                    showToast(res.data.isSaved ? 'Saved!' : 'Unsaved', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // showToast(`Loaded ${events.length} events`, 'success');
    } catch (err) {
        showToast(err.message || 'Failed to load events', 'error');
    }
}

async function loadComments(eventId, page = 1) {
    try {
        const response = await apiClient.get(`/api/events/${eventId}/comments?page=${page}`);
        const container = document.getElementById('comment-list');
        const paginationContainer = document.getElementById('comment-pagination');

        if (!container) return;

        const comments = response.data.data;
        const meta = response.data.meta;

        container.innerHTML = comments
            .map((comment) => renderCommentCard(comment))
            .join('');

        container.querySelectorAll('.delete-comment-btn').forEach((button) => {
            button.addEventListener('click', () => deleteComment(button.dataset.commentId));
        });

        container.querySelectorAll('.like-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!requireAuth()) return;
                const commentId = btn.dataset.commentId;
                try {
                    const res = await apiClient.post(`/api/events/${eventId}/comments/${commentId}/like`);
                    const countSpan = btn.querySelector('span');
                    if (res.data) {
                        btn.classList.toggle('active', res.data.hasLiked);
                        if (countSpan) countSpan.textContent = res.data.totalLikes;
                    }
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });

        if (paginationContainer && meta) {
            const pages = Math.ceil(meta.total / (meta.limit || 20));
            let html = '';
            for (let i = 1; i <= pages; i++) {
                const active = i === meta.page ? 'active' : '';
                html += `<button class="pagination-btn ${active}" data-page="${i}">${i}</button>`;
            }
            paginationContainer.innerHTML = html;
            paginationContainer.querySelectorAll('.pagination-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    loadComments(eventId, parseInt(btn.dataset.page, 10));
                });
            });
        }
    } catch (err) {
        showToast(err.message || 'Failed to load comments', 'error');
    }
}

async function deleteComment(commentId) {
    if (!requireAuth()) return;
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    try {
        await apiClient.delete(`/api/comments/${commentId}`);
        showToast('Comment deleted', 'success');
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('id');
        if (eventId) loadComments(eventId, 1);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ========== PROFILE ==========
async function loadProfile() {
    const user = getUser();
    if (!user) return;

    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userMajorEl = document.getElementById('user-major');
    const userCreatedAtEl = document.getElementById('user-created-at');
    const userAvatarEl = document.getElementById('user-avatar');

    const renderUser = (profile) => {
        const name = profile.fullName || 'User';
        if (userNameEl) userNameEl.textContent = name;
        if (userEmailEl) userEmailEl.textContent = profile.email || '';
        if (userMajorEl) userMajorEl.textContent = profile.major ? `Major: ${profile.major}` : '';
        if (userCreatedAtEl) userCreatedAtEl.textContent = profile.createdAt ? `Member since: ${formatDate(profile.createdAt)}` : '';
        if (userAvatarEl) {
            userAvatarEl.src = profile.avatarUrl || avatarUrl(name);
            userAvatarEl.alt = `${name}'s avatar`;
        }
    };

    renderUser(user);
    try {
        const response = await apiClient.get('/api/users/me');
        const profile = response.data || response;
        renderUser(profile);
        setUser({ ...user, ...profile });
    } catch (err) {
        showToast(err.message || 'Failed to load profile', 'error');
    }
}

// ========== SAVED EVENTS ==========
async function loadSavedEvents(page = 1) {
    const container = document.getElementById('saved-list');
    const pagination = document.getElementById('saved-pagination');
    if (!container) return;

    container.innerHTML = renderSkeletonCards(8);

    try {
        const response = await apiClient.get(`/api/events/saved?page=${page}&limit=20`);
        const events = response.data.data;
        const meta = response.data.meta;

        if (events.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                    <p class="text-muted">No saved events yet.</p>
                    <a href="index.html" class="btn btn-primary">Browse events</a>
                </div>`;
            pagination.innerHTML = '';
            return;
        }

        container.innerHTML = events.map((event) => renderEventCard(event, { showActions: true })).join('');

        container.querySelectorAll('.event-card').forEach((card) => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const id = card.dataset.eventId;
                if (id) window.location.href = `event-detail.html?id=${id}`;
            });
        });

        container.querySelectorAll('.upvote-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!requireAuth()) return;
                btn.disabled = true;
                try {
                    const res = await apiClient.post(`/api/events/${btn.dataset.eventId}/upvote`);
                    btn.classList.toggle('active', res.data.hasUpvoted);
                    const countEl = btn.querySelector('span');
                    if (countEl) countEl.textContent = res.data.totalUpvotes ?? countEl.textContent;
                    showToast(res.data.hasUpvoted ? 'Upvoted!' : 'Upvote removed', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        container.querySelectorAll('.save-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!requireAuth()) return;
                btn.disabled = true;
                try {
                    const res = await apiClient.post(`/api/events/${btn.dataset.eventId}/save`);
                    showToast(res.data.isSaved ? 'Saved!' : 'Unsaved', 'success');
                    if (!res.data.isSaved) {
                        const card = btn.closest('.event-card');
                        if (card) card.remove();
                    } else {
                        btn.classList.add('active');
                    }
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        pagination.innerHTML = renderPagination(meta.total, meta.page);
        pagination.querySelectorAll('.pagination-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pageNum = parseInt(btn.dataset.page, 10);
                loadSavedEvents(pageNum);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    } catch (err) {
        showToast(err.message || 'Failed to load saved events', 'error');
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                <p class="text-muted">Failed to load saved events.</p>
            </div>`;
        pagination.innerHTML = '';
    }
}

async function loadMyEvents() {
    const user = getUser();
    if (!user) return;
    const container = document.getElementById('my-events-list');
    const pagination = document.getElementById('my-events-pagination');
    if (!container) return;
    const page = Number(new URLSearchParams(window.location.search).get('eventsPage') || 1);
    container.innerHTML = renderSkeletonCards(4);
    try {
        const response = await apiClient.get(`/api/users/me/events?page=${page}&limit=20`);
        const payload = response.data || {};
        const events = payload.data || [];
        const meta = payload.meta || { total: events.length, page, limit: 20 };
        if (!events.length) {
            container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;"><p class="text-muted">You have not created any events yet.</p><a href="create-event.html" class="btn btn-primary">Create an event</a></div>';
            if (pagination) pagination.innerHTML = '';
            return;
        }
        container.innerHTML = events.map((event) => renderEventCard(event, { isOwner: true })).join('');
        container.querySelectorAll('.event-card').forEach((card) => card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) window.location.href = `event-detail.html?id=${encodeURIComponent(card.dataset.eventId)}`;
        }));
        bindEventOwnerActions(container, () => loadMyEvents());
        if (pagination) {
            pagination.innerHTML = renderPagination(meta.total, meta.page);
            pagination.querySelectorAll('.pagination-btn').forEach((button) => button.addEventListener('click', () => {
                const nextPage = Number(button.dataset.page);
                const next = new URL(window.location.href);
                next.searchParams.set('tab', 'events');
                next.searchParams.set('eventsPage', nextPage);
                history.replaceState(null, '', next);
                loadMyEvents(nextPage);
            }));
        }
    } catch (err) {
        showToast(err.message, 'error');
        container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;"><p class="text-error">Failed to load your events.</p></div>';
    }
}

async function loadMyComments(page = null) {
    const user = getUser();
    if (!user) return;
    const container = document.getElementById('my-comments-list');
    const pagination = document.getElementById('my-comments-pagination');
    if (!container) return;
    const currentPage = page || Number(new URLSearchParams(window.location.search).get('commentsPage') || 1);
    container.innerHTML = renderSkeletonComments(3);
    try {
        const response = await apiClient.get(`/api/users/me/comments?page=${currentPage}&limit=20`);
        const payload = response.data || {};
        const comments = payload.data || [];
        const meta = payload.meta || { total: comments.length, page: currentPage, limit: 20 };
        if (!comments.length) {
            container.innerHTML = '<div class="empty-state" style="text-align: center; padding: 3rem 1rem;"><p class="text-muted">You have not posted any comments yet.</p></div>';
            if (pagination) pagination.innerHTML = '';
            return;
        }
        container.innerHTML = comments.map((comment) => {
            const eventId = comment.event?.id || comment.eventId;
            const eventTitle = comment.event?.title || comment.eventTitle || 'View event';
            return `<article class="profile-comment-item">${renderCommentCard(comment, { ownerOverride: true })}<a class="comment-event-link" href="event-detail.html?id=${encodeURIComponent(eventId || '')}">${escapeHtml(eventTitle)}</a></article>`;
        }).join('');
        container.querySelectorAll('.delete-comment-btn').forEach((button) => button.addEventListener('click', () => deleteCommentFromProfile(button.dataset.commentId)));
        if (pagination) {
            pagination.innerHTML = renderPagination(meta.total, meta.page);
            pagination.querySelectorAll('.pagination-btn').forEach((button) => button.addEventListener('click', () => {
                const next = new URL(window.location.href);
                next.searchParams.set('tab', 'comments');
                next.searchParams.set('commentsPage', button.dataset.page);
                history.replaceState(null, '', next);
                loadMyComments(Number(button.dataset.page));
            }));
        }
    } catch (err) {
        showToast(err.message, 'error');
        container.innerHTML = '<div class="empty-state" style="text-align: center; padding: 3rem 1rem;"><p class="text-error">Failed to load your comments.</p></div>';
    }
}

function renderSkeletonComments(count) {
    return Array.from({ length: count }, () => '<div class="skeleton" style="height: 72px;"></div>').join('');
}

async function deleteCommentFromProfile(commentId) {
    if (!requireAuth() || !window.confirm('Delete this comment? This cannot be undone.')) return;
    try {
        await apiClient.delete(`/api/comments/${commentId}`);
        showToast('Comment deleted', 'success');
        loadMyComments();
    } catch (err) { showToast(err.message, 'error'); }
}

// Navigate back when there is history, otherwise fall back to home
function goBack() {
    const sameOrigin = document.referrer && new URL(document.referrer).origin === location.origin;
    if (sameOrigin || history.length > 1) {
        history.back();
    } else {
        window.location.href = 'index.html';
    }
}

// Expose globals for inline handlers
window.formatDate = formatDate;
window.showToast = showToast;
window.deleteComment = deleteComment;
window.goBack = goBack;
