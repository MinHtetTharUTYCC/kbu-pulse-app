// ========== KBU PULSE - Main Application ==========
// All logic merged into single file for static server compatibility

import { capitalize } from './util.js';

// ========== CONFIG ==========
const API_BASE_URL = 'http://localhost:3000';
const AUTH_KEY = 'kbu_pulse_user';

// ========== UTILITIES ==========
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span>${message}</span>
        <button class="btn btn-sm btn-secondary" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
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
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(body),
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
                <span class="event-card-meta">${capitalize(event.category)}</span>
                ${
                    showButtons
                        ? `
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-icon upvote-btn${event.hasUpvoted ? ' active' : ''}" data-event-id="${event.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg><span>${event.upvoteCount || 0}</span></button>
                        <button class="btn-icon save-btn${event.hasSaved ? ' active' : ''}" data-event-id="${event.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.2rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${event.commentCount || 0}</span>
                    </div>
                `
                        : ''
                }
            </div>
        </div>
    `;
}

function renderCommentCard(comment) {
    const eventTitle = comment.event ? comment.event.title : '';
    return `
        <div class="comment-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                <span class="comment-meta" style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(comment.createdAt)}</span>
                ${comment.userId === 'current' ? `<button class="btn btn-xs btn-secondary" onclick="deleteComment('${comment.id}')">×</button>` : ''}
            </div>
            <p class="comment-content" style="font-size: 0.875rem; margin: 0.25rem 0;">${comment.content}</p>
            ${eventTitle ? `<small class="comment-event" style="font-size: 0.7rem; color: var(--text-muted);">in ${eventTitle}</small>` : ''}
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
            <h2 class="text-xl font-bold">${event.title}</h2>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                <img src="${event.creator?.avatarUrl || 'assets/kbu.webp'}" alt="${event.creator?.fullName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${event.creator?.fullName || 'Unknown'} <span class="text-muted" style="font-weight: 400;">(${event.creator?.major || ''})</span></div>
                    <div class="text-muted" style="font-size: 0.8rem;">${event.category} · ${formatDate(event.createdAt)}</div>
                </div>
            </div>
            ${
                event.imageUrls && event.imageUrls.length > 0
                    ? `<img class="event-card-img" src="${event.imageUrls[0]}" alt="${event.title}">`
                    : `<img class="event-card-img" src="assets/kbu.webp" alt="${event.title}">`
            }
            <p style="font-size: 0.9rem; margin: 0.5rem 0;">${event.description}</p>
        `;

        const commentCountEl = document.getElementById('comment-count');
        if (commentCountEl && event.commentCount) commentCountEl.textContent = `(${event.commentCount})`;

        const eventActions = document.querySelector('.event-actions');
        if (eventActions) eventActions.style.display = 'block';

        const upvoteBtn = document.querySelector('.upvote-btn');
        if (upvoteBtn) {
            upvoteBtn.dataset.eventId = eventId;
            if (event.hasUpvoted) upvoteBtn.classList.add('active');
            upvoteBtn.querySelector('span')?.remove();
            const countSpan = document.createElement('span');
            countSpan.textContent = event.upvoteCount || 0;
            upvoteBtn.appendChild(countSpan);
            upvoteBtn.addEventListener('click', async () => {
                try {
                    await apiClient.patch(`/api/events/${eventId}/upvote`);
                    showToast('Upvoted!', 'success');
                    window.location.href = window.location.href;
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.dataset.eventId = eventId;
            if (event.hasSaved) saveBtn.classList.add('active');
            saveBtn.addEventListener('click', async () => {
                try {
                    await apiClient.patch(`/api/events/${eventId}/save`);
                    showToast('Saved!', 'success');
                    window.location.href = window.location.href;
                } catch (err) {
                    showToast(err.message, 'error');
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
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = e.target.elements.title.value.trim();
        const description = e.target.elements.description.value.trim();
        const category = e.target.elements.category.value;
        const imageUrl = e.target.elements.imageUrl.value.trim();

        if (!title || !description || !category) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            await apiClient.post('/api/events/', { title, description, category, imageUrl });
            showToast('Event created!', 'success');
            window.location.href = 'index.html';
        } catch (err) {
            showToast(err.message, 'error');
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
                        <p class="text-muted mb-4">No events match your filters.</p>
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

        const events20x = Array.from({ length: 20 }, () => events).flat();

        container.innerHTML = events20x.map((event) => renderEventCard(event, true)).join('');

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
                const eventId = btn.dataset.eventId;
                try {
                    await apiClient.patch(`/api/events/${eventId}/upvote`);
                    showToast('Upvoted!', 'success');
                    loadEvents(page, category, major, search, sort);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });

        document.querySelectorAll('.save-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                try {
                    await apiClient.patch(`/api/events/${eventId}/save`);
                    showToast('Saved!', 'success');
                    loadEvents(page, category, major, search, sort);
                } catch (err) {
                    showToast(err.message, 'error');
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

        if (!container) return;

        const comments = response.data.data;

        container.innerHTML = comments
            .map((comment) => {
                return renderCommentCard({ ...comment, event: { title: 'KBU PULSE Event' } });
            })
            .join('');
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
        const response = await apiClient.get(`/api/users/me/events`);
        const container = document.getElementById('my-events-list');

        if (!container) return;

        const events = response.data.data;

        if (events.length === 0) {
            container.innerHTML =
                '<p class="text-muted">No events yet. <a href="create-event.html">Create your first event</a></p>';
            return;
        }

        container.innerHTML = events.map((event) => renderEventCard(event, true)).join('');

        // Attach listeners
        document.querySelectorAll('.upvote-btn, .save-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.eventId;
                try {
                    await apiClient.patch(`/api/events/${eventId}/upvote`);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadMyComments() {
    const user = getUser();
    if (!user) return;

    try {
        const response = await apiClient.get(`/api/users/me/comments`);
        const container = document.getElementById('my-comments-list');

        if (!container) return;

        const comments = response.data.data;

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-muted">No comments yet.</p>';
            return;
        }

        container.innerHTML = comments
            .map((comment) => {
                const eventTitle = comment.event ? comment.event.title : 'Event';
                return `
                <div class="comment-card">
                    <p class="comment-content" style="font-size: 0.875rem; margin: 0.25rem 0;">${comment.content}</p>
                    <small class="comment-event" style="font-size: 0.7rem; color: var(--text-muted);">in ${eventTitle}</small>
                </div>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Expose globals for inline handlers
window.formatDate = formatDate;
window.showToast = showToast;
