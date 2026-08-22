// ========== KBU PULSE - Main Application ==========
// All logic merged into single file for static server compatibility

import { capitalize, formatCategory } from './util.js';

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
function renderEventCard(event, showButtons = false) {
    return `
        <div class="event-card">
            ${
                event.imageUrls && event.imageUrls.length > 0
                    ? `<img class="event-card-img" src="${event.imageUrls[0]}" alt="${event.title}">`
                    : `<img class="event-card-img" src="assets/kbu.webp" alt="${event.title}">`
            }
            <h3 class="event-card-title" style="font-size: 1rem; margin: 0.5rem 0;">${event.title}</h3>
            <p class="event-card-desc" style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">${truncate(event.description, 80)}</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="event-card-meta">${formatCategory(event.category)}</span>
                ${
                    showButtons
                        ? `
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-icon upvote-btn${event.hasUpvoted ? ' active' : ''}" data-event-id="${event.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span>${event.upvoteCount || 0}</span></button>
                        <button class="btn-icon save-btn${event.hasSaved ? ' active' : ''}" data-event-id="${event.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
                        <button class="btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${event.commentCount || 0}</button>
                    </div>
                `
                        : ''
                }
            </div>
        </div>
    `;
}

function renderCommentCard(comment) {
    const author = comment.author || {};
    const currentUser = getUser();
    const isOwner = currentUser && author.id === currentUser.id;
    const commentId = comment.id;
    return `
        <div class="comment-card">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <img src="${author.avatarUrl || 'assets/placeholder.svg'}" alt="${author.fullName}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                <span style="font-size: 0.8rem; font-weight: 600;">${author.fullName || 'Unknown'}</span>
                <span class="text-muted" style="font-size: 0.7rem;">${formatDate(comment.createdAt)}</span>
                ${isOwner ? `<button class="btn btn-xs btn-secondary" style="margin-left: auto;" onclick="deleteComment('${commentId}')">×</button>` : ''}
            </div>
            <p class="comment-content" style="font-size: 0.875rem; margin: 0.25rem 0;">${comment.content}</p>
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
    const path = window.location.pathname;

    // Render navbar
    if (window.navbar) window.navbar.renderNavbar(path);

    // Protected pages check
    const protectedPages = ['profile.html', 'create-event.html', 'event-detail.html'];
    const user = getUser();
    if (protectedPages.includes(path) && !user) {
        clearUser();
        window.location.href = 'login.html';
        return;
    }

    // Route to page handler
    if (path.includes('index.html') || path === '/') {
        initHomePage();
    } else if (path.includes('login.html')) {
        initLoginPage();
    } else if (path.includes('register.html')) {
        initRegisterPage();
    } else if (path.includes('event-detail.html')) {
        initEventDetailPage();
    } else if (path.includes('profile.html')) {
        console.log('Initializing profile page');
        initProfilePage();
    } else if (path.includes('saved.html')) {
        console.log('Initializing saved events page');
        initSavedEventsPage(); // Reuse profile page logic for saved events
    } else if (path.includes('create-event.html')) {
        initCreateEventPage();
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = e.target.elements.fullName.value.trim();
        const email = e.target.elements.email.value.trim();
        const major = e.target.elements.major.value;
        const password = e.target.elements.password.value.trim();

        if (!major) {
            showToast('Please select a major', 'error');
            return;
        }

        try {
            const data = await apiClient.post('/api/auth/register', {
                fullName,
                email,
                major,
                password,
            });
            setUser(data.data);
            showToast('Registration successful!', 'success');
            window.location.href = 'index.html';
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

    try {
        const res = await apiClient.get(`/api/events/${eventId}`);
       
        const event = res.data;

        const header = document.getElementById('event-header');
        if (!header) return;

        header.innerHTML = `
            <h2 class="section-title">${event.title}</h2>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <img src="${event.creator?.avatarUrl || 'assets/kbu.webp'}" alt="${event.creator?.fullName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${event.creator?.fullName || 'Unknown'}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${event.creator?.major || ''}</div>
                </div>
            </div>
            <div class="event-meta" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                ${event.major ? `<span class="meta-badge meta-major">${event.major}</span>` : ''}
                <span class="meta-badge meta-category">${formatCategory(event.category)}</span>
                <span class="meta-badge meta-date">${formatDate(event.createdAt)}</span>
            </div>
            ${
                event.imageUrls && event.imageUrls.length > 0
                    ? `<div class="event-images-grid">${event.imageUrls.map((url, i) => `<img class="event-card-img" src="${url}" alt="${event.title} ${i + 1}" data-image-index="${i}" style="cursor: pointer;">`).join('')}</div>`
                    : `<img class="event-card-img" src="assets/kbu.webp" alt="${event.title}">`
            }
            <p style="font-size: 0.9rem; margin: 0.5rem 0;">${event.description}</p>
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

    const activeTab = localStorage.getItem('profileTab');
    if (activeTab === 'events') {
        loadMyEvents();
    } else if (activeTab === 'comments') {
        loadMyComments();
    }

    // TODO: this is the example how we show profile content from API
    // you can check the api docs what it returns from /api/users/me and display it in the profile page
    document.getElementById('user-name').textContent = user.fullName;
    document.getElementById('user-email').textContent = user.email;

    document.querySelectorAll('.profile-tab').forEach((tab) => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
            e.target.classList.add('active');
            const tabName = e.target.dataset.tab;
            localStorage.setItem('profileTab', tabName);

            document.querySelectorAll('.profile-section').forEach((section) => {
                section.classList.toggle('active', section.dataset.tab === tabName);
            });

            if (tabName === 'events') {
                loadMyEvents();
            } else if (tabName === 'comments') {
                loadMyComments();
            }
        });
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        clearUser();
        window.location.href = 'index.html';
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

        container.innerHTML = events.map((event) => renderEventCard(event, true)).join('');

        container.querySelectorAll('.event-card').forEach((card) => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (e.target.closest('.upvote-btn') || e.target.closest('.save-btn')) return;
                const id = card.querySelector('.upvote-btn')?.dataset.eventId;
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

// ========== PROFILE ==========
async function loadProfile() {
    const user = getUser();
    if (!user) return;

    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = user.fullName;

    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) userAvatarEl.src = user.avatarUrl || 'assets/placeholder.svg';

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        userInfoEl.innerHTML = `
            <img src="${user.avatarUrl || 'assets/placeholder.svg'}" alt="${user.fullName}'s avatar" class="avatar">
            <span>${user.fullName}</span>
        `;
    }
}

async function loadMyEvents() {
    const user = getUser();
    if (!user) return;

    try {
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadMyComments() {
    const user = getUser();
    if (!user) return;

    try {
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Expose globals for inline handlers
window.formatDate = formatDate;
window.showToast = showToast;
