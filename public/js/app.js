// State
let state = {
    user: null,
    isAuthenticated: false
};

// API Helper
const api = {
    get: async (url) => {
        const res = await fetch(url);
        return res.json();
    },
    post: async (url, data = {}) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    }
};

// Router
const routes = {
    '/': renderHome,
    '/scripts': renderScripts,
    '/login': renderLogin,
    '/register': renderRegister,
    '/profile': renderProfile,
    '/scripts/create': renderCreateScript,
    '/premium': renderPremium,
    '/forgot': renderForgot
};

async function init() {
    // Check Auth
    try {
        const res = await api.get('/api/auth/me');
        if (res.isAuthenticated) {
            state.user = res.user;
            state.isAuthenticated = true;
        }
    } catch (e) {
        console.error('Auth check failed', e);
    }

    // Initial Render
    updateNavbar();
    document.getElementById('footer').innerHTML = Components.footer();

    // Handle URL
    handleLocation();

    // Browser Back/Forward
    window.addEventListener('popstate', handleLocation);
}

function updateNavbar() {
    document.getElementById('navbar').innerHTML = Components.navbar(state.user);
}

async function route(event, path) {
    event.preventDefault();
    window.history.pushState({}, "", path);
    handleLocation();
}

async function handleLocation() {
    const path = window.location.pathname;
    const main = document.getElementById('main-content');

    // Simple regex matching for dynamic routes
    if (path.match(/^\/scripts\/[a-f0-9]{24}$/)) {
        const id = path.split('/').pop();
        renderScriptDetail(id);
        return;
    }

    // Reset Password Route
    if (path.match(/^\/reset\/[a-f0-9]+$/)) {
        const token = path.split('/').pop();
        renderReset(token);
        return;
    }

    const handler = routes[path] || renderHome;

    // Protected Routes
    const protectedRoutes = ['/profile', '/scripts/create', '/premium'];
    if (protectedRoutes.includes(path) && !state.isAuthenticated) {
        Components.toast('Please login to access this page', 'error');
        window.history.pushState({}, "", '/login');
        renderLogin();
        return;
    }

    handler();
}

// Views
async function renderHome() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <section class="hero">
            <div class="hero-content container">
                <h1 class="text-gradient">Next Generation<br>Script Development</h1>
                <p>The ultimate platform for scriptwriters and show developers. Join our premium vault today.</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <a href="/scripts" class="btn btn-primary" onclick="route(event, '/scripts')">Explore Scripts</a>
                    <a href="/register" class="btn btn-outline" onclick="route(event, '/register')">Join Now</a>
                </div>
            </div>
        </section>
        
        <!-- Trending Scripts Carousel -->
        <section class="container" style="margin-bottom: 4rem;">
            <h2 style="margin-bottom: 2rem; text-align: center;">✨ Trending Scripts</h2>
            <div class="carousel-container">
                <div class="scripts-carousel" id="trending-carousel">
                    ${Components.skeletonLoader(4)}
                </div>
            </div>
        </section>
        
        <section class="container" id="featured-posts">
            <h2 style="margin-bottom: 2rem;">Latest Updates</h2>
            <div class="grid" id="posts-grid">${Components.loader()}</div>
        </section>
    `;

    // Fetch trending scripts
    try {
        const scriptsData = await api.get('/api/scripts');
        const carousel = document.getElementById('trending-carousel');
        if (scriptsData.success && scriptsData.scripts.length > 0) {
            // Show top 6 trending scripts (by rating and views)
            const trending = scriptsData.scripts
                .sort((a, b) => (b.averageRating * b.views) - (a.averageRating * a.views))
                .slice(0, 6);
            carousel.innerHTML = trending.map(script => Components.scriptCard(script)).join('');
        } else {
            carousel.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No scripts available yet.</p>';
        }
    } catch (e) {
        document.getElementById('trending-carousel').innerHTML = '<p>Error loading trending scripts</p>';
    }

    // Fetch Posts (Mocking for now as we didn't implement Post API fully yet)
    // In real app: const data = await api.get('/api/posts');
    const postsGrid = document.getElementById('posts-grid');
    postsGrid.innerHTML = `
        <div class="card">
            <h3 class="card-title">Welcome to Nova</h3>
            <p class="card-desc">We are live! Explore the new features.</p>
        </div>
        <div class="card">
            <h3 class="card-title">Premium Vault Open</h3>
            <p class="card-desc">Access exclusive scripts now.</p>
        </div>
    `;
}

async function renderScripts() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="container" style="padding-top: 120px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2>Script Directory</h2>
                ${state.isAuthenticated ? `<a href="/scripts/create" class="btn btn-primary" onclick="route(event, '/scripts/create')">Upload Script</a>` : ''}
            </div>
            
            <!-- Search and Filter Controls -->
            <div class="search-controls" style="margin-bottom: 2rem;">
                <input type="text" id="search-input" class="form-input" placeholder="🔍 Search scripts by title, description, or author..." style="margin-bottom: 1rem;">
                
                <div class="genre-filters" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="filter-btn active" data-genre="all">All</button>
                    <button class="filter-btn" data-genre="Drama">Drama</button>
                    <button class="filter-btn" data-genre="Comedy">Comedy</button>
                    <button class="filter-btn" data-genre="Sci-Fi">Sci-Fi</button>
                    <button class="filter-btn" data-genre="Horror">Horror</button>
                    <button class="filter-btn" data-genre="Thriller">Thriller</button>
                    <button class="filter-btn" data-genre="Romance">Romance</button>
                    <button class="filter-btn" data-genre="Action">Action</button>
                    <button class="filter-btn" data-genre="Documentary">Documentary</button>
                    <button class="filter-btn" data-genre="Short Film">Short Film</button>
                    <button class="filter-btn" data-genre="Other">Other</button>
                </div>
            </div>
            
            <div class="grid" id="scripts-grid">${Components.loader()}</div>
        </div>
    `;

    try {
        const data = await api.get('/api/scripts');
        const grid = document.getElementById('scripts-grid');

        if (data.success && data.scripts.length > 0) {
            // Store scripts for filtering
            window.allScripts = data.scripts;
            displayScripts(data.scripts);

            // Setup search
            const searchInput = document.getElementById('search-input');
            searchInput.addEventListener('input', (e) => {
                filterScripts();
            });

            // Setup genre filters
            const filterButtons = document.querySelectorAll('.filter-btn');
            filterButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    filterScripts();
                });
            });
        } else {
            grid.innerHTML = '<p>No scripts found.</p>';
        }
    } catch (e) {
        document.getElementById('scripts-grid').innerHTML = '<p>Error loading scripts.</p>';
    }
}

function filterScripts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const activeGenre = document.querySelector('.filter-btn.active').dataset.genre;

    let filtered = window.allScripts;

    // Filter by genre
    if (activeGenre !== 'all') {
        filtered = filtered.filter(script => script.genre === activeGenre);
    }

    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(script => {
            const title = script.title.toLowerCase();
            const desc = (script.description || '').toLowerCase();
            const author = script.author ? script.author.name.toLowerCase() : '';
            return title.includes(searchTerm) || desc.includes(searchTerm) || author.includes(searchTerm);
        });
    }

    displayScripts(filtered);
}

function displayScripts(scripts) {
    const grid = document.getElementById('scripts-grid');
    if (scripts.length > 0) {
        grid.innerHTML = scripts.map(script => Components.scriptCard(script)).join('');
    } else {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No scripts match your search.</p>';
    }
}

async function renderScriptDetail(id) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="container" style="padding-top: 120px;">${Components.loader()}</div>`;

    try {
        const data = await api.get(`/api/scripts/${id}`);
        if (data.success) {
            const script = data.script;
            const isAuthor = state.user && script.author && script.author._id === state.user._id;
            const editsRemaining = 3 - (script.editCount || 0);

            main.innerHTML = `
                <div class="container" style="padding-top: 120px;">
                    <a href="/scripts" class="btn btn-outline" onclick="route(event, '/scripts')" style="margin-bottom: 1rem;">&larr; Back to Scripts</a>
                    
                    <div class="card" style="border: none; background: transparent;">
                        <!-- Header with Title and Genre -->
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <h1 class="text-gradient" style="margin: 0;">${script.title}</h1>
                            <span class="genre-tag" style="font-size: 1rem; padding: 0.5rem 1rem;">${script.genre || 'Other'}</span>
                        </div>
                        
                        <!-- Metadata Row -->
                        <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem; color: var(--text-secondary);">
                            <span><i class="fas fa-user"></i> By ${script.author ? script.author.name : 'Unknown'}</span>
                            <span><i class="fas fa-calendar"></i> ${new Date(script.createdAt).toLocaleDateString()}</span>
                            <span><i class="fas fa-file-alt"></i> ${script.pageCount || 0} pages</span>
                            <span><i class="fas fa-language"></i> ${script.language || 'English'}</span>
                        </div>
                        
                        <!-- Rating Display -->
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2rem;">
                            <div class="rating-stars">
                                ${Components.renderStars(script.averageRating || 0)}
                            </div>
                            <span style="color: var(--text-secondary);">${script.averageRating ? script.averageRating.toFixed(1) : '0.0'} (${script.totalRatings || 0} ratings)</span>
                        </div>
                        
                        <!-- Description -->
                        <div style="background: var(--bg-card); padding: 2rem; border-radius: 16px; margin-bottom: 2rem;">
                            <h3>Description</h3>
                            <p style="color: var(--text-secondary); line-height: 1.6;">${script.description || 'No description provided'}</p>
                        </div>
                        
                        <!-- Community Rating Form -->
                        ${!isAuthor && state.isAuthenticated ? `
                        <div style="background: var(--bg-card); padding: 2rem; border-radius: 16px; margin-bottom: 2rem;">
                            <h3>Rate this Script</h3>
                            <form id="rating-form" style="margin-top: 1rem;">
                                <div class="rating-input" style="display: flex; gap: 0.5rem; font-size: 1.5rem; margin-bottom: 1rem;">
                                    <i class="far fa-star star-btn" data-value="1"></i>
                                    <i class="far fa-star star-btn" data-value="2"></i>
                                    <i class="far fa-star star-btn" data-value="3"></i>
                                    <i class="far fa-star star-btn" data-value="4"></i>
                                    <i class="far fa-star star-btn" data-value="5"></i>
                                </div>
                                <input type="hidden" name="rating" id="rating-value" value="0">
                                <textarea name="comment" class="form-textarea" rows="2" placeholder="Leave a comment (optional)..." style="margin-bottom: 1rem;"></textarea>
                                <button type="submit" class="btn btn-primary">Submit Rating</button>
                            </form>
                        </div>
                        ` : ''}
                        
                        ${isAuthor ? `
                        <!-- Author Actions -->
                        <div class="script-actions" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem; padding: 1.5rem; background: var(--bg-card); border-radius: 8px;">
                            <button class="btn btn-primary" onclick="renderScriptEdit('${script._id}')" 
                                ${editsRemaining <= 0 ? 'disabled title="Edit limit reached (3/3)"' : ''}>
                                <i class="fas fa-edit"></i> Edit Script 
                                ${editsRemaining > 0 ? `(${editsRemaining} edits left)` : '(No edits left)'}
                            </button>
                            <button class="btn btn-danger" onclick="deleteScript('${script._id}')">
                                <i class="fas fa-trash"></i> Delete Script
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            // Setup rating stars interaction
            if (!isAuthor && state.isAuthenticated) {
                const stars = document.querySelectorAll('.star-btn');
                const ratingInput = document.getElementById('rating-value');
                stars.forEach(star => {
                    star.addEventListener('click', (e) => {
                        const val = parseInt(e.target.dataset.value);
                        ratingInput.value = val;
                        stars.forEach((s, idx) => {
                            if (idx < val) {
                                s.className = 'fas fa-star star-btn';
                                s.style.color = 'gold';
                            } else {
                                s.className = 'far fa-star star-btn';
                                s.style.color = '';
                            }
                        });
                    });
                });

                document.getElementById('rating-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const rating = document.getElementById('rating-value').value;
                    if (rating === "0") return Components.toast('Please select a rating', 'error');

                    const data = {
                        rating: parseInt(rating),
                        comment: e.target.comment.value
                    };

                    const res = await api.post(`/api/scripts/${script._id}/rate`, data);
                    if (res.success) {
                        Components.toast('Thank you for your rating!');
                        renderScriptDetail(script._id); // Refresh
                    } else {
                        Components.toast(res.message || 'Error submitting rating', 'error');
                    }
                });
            }
        } else {
            main.innerHTML = `<div class="container" style="padding-top: 120px;"><h2>${data.message || 'Script not found'}</h2></div>`;
        }
    } catch (e) {
        console.error('Error loading script:', e);
        main.innerHTML = `<div class="container" style="padding-top: 120px;"><h2>Error loading script</h2></div>`;
    }
}


async function renderLogin() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-container">
            <h2 class="text-gradient" style="text-align: center; margin-bottom: 2rem;">Welcome Back</h2>
            <form id="login-form">
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
                 <div style="display: flex; justify-content: space-between; margin-top: 1rem;">
                    <a href="/forgot" onclick="route(event, '/forgot')" style="color: var(--text-secondary); font-size: 0.9rem;">Forgot Password?</a>
                     <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        No account? <a href="/register" onclick="route(event, '/register')" style="color: var(--primary);">Register</a>
                    </p>
                </div>
                 <!-- Social Auth -->
                <div style="margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 2rem;">
                    <a href="/api/auth/google" class="btn btn-outline" style="width: 100%; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fab fa-google"></i> Continue with Google
                    </a>
                    <a href="/api/auth/facebook" class="btn btn-outline" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <i class="fab fa-facebook-f"></i> Continue with Facebook
                    </a>
                </div>
            </form>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const res = await api.post('/api/auth/login', data);
            if (res.success) {
                state.user = res.user;
                state.isAuthenticated = true;
                updateNavbar();
                Components.toast('Login successful!');
                window.history.pushState({}, "", '/');
                renderHome();
            } else {
                Components.toast(res.message || 'Login failed', 'error');
            }
        } catch (err) {
            Components.toast('An error occurred', 'error');
        }
    });
}

function renderForgot() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-container">
            <h2 class="text-gradient" style="text-align: center; margin-bottom: 2rem;">Reset Password</h2>
            <form id="forgot-form">
                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" name="email" class="form-input" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Send Reset Link</button>
                <a href="/login" onclick="route(event, '/login')" class="btn btn-outline" style="width: 100%; margin-top: 1rem; text-align: center;">Back to Login</a>
            </form>
        </div>
    `;

    document.getElementById('forgot-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const res = await api.post('/api/auth/forgot', data);
            if (res.success) {
                Components.toast(res.message);
            } else {
                Components.toast(res.message || 'Error sending email', 'error');
            }
        } catch (err) {
            Components.toast('An error occurred', 'error');
        }
    });
}

function renderReset(token) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-container">
            <h2 class="text-gradient" style="text-align: center; margin-bottom: 2rem;">New Password</h2>
            <form id="reset-form">
                <div class="form-group">
                    <label class="form-label">New Password</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Confirm Password</label>
                    <input type="password" name="confirmPassword" class="form-input" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Change Password</button>
            </form>
        </div>
    `;

    document.getElementById('reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const res = await api.post(`/api/auth/reset/${token}`, data);
            if (res.success) {
                Components.toast('Password changed successfully. Please login.');
                window.history.pushState({}, "", '/login');
                renderLogin();
            } else {
                Components.toast(res.message || 'Error resetting password', 'error');
            }
        } catch (err) {
            Components.toast('An error occurred', 'error');
        }
    });
}

function renderRegister() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="form-container">
            <h2 class="text-gradient" style="text-align: center; margin-bottom: 2rem;">Join Nova</h2>
            <form id="register-form">
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Confirm Password</label>
                    <input type="password" name="confirmPassword" class="form-input" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Register</button>
            </form>
        </div>
    `;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const res = await api.post('/api/auth/register', data);
            if (res.success) {
                state.user = res.user;
                state.isAuthenticated = true;
                updateNavbar();
                Components.toast('Welcome to Nova!');
                window.history.pushState({}, "", '/');
                renderHome();
            } else {
                Components.toast(res.message || 'Registration failed', 'error');
            }
        } catch (err) {
            Components.toast('An error occurred', 'error');
        }
    });
}

async function renderProfile() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="container" style="padding-top: 120px;">${Components.loader()}</div>`;

    try {
        const data = await api.get('/api/user/profile');
        if (data.success) {
            const user = data.profile;
            main.innerHTML = `
                <div class="container" style="padding-top: 120px;">
                    <div style="display: flex; gap: 4rem; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 300px;">
                            <h2 class="text-gradient" style="margin-bottom: 2rem;">My Profile</h2>
                            <div class="card" style="margin-bottom: 2rem; position: relative; text-align: center; padding: 3rem 2rem;">
                                <div style="position: relative; width: 150px; height: 150px; margin: 0 auto 1.5rem;">
                                    <img src="${user.avatar || 'https://via.placeholder.com/150'}" id="profile-avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary);">
                                    <label for="avatar-upload" style="position: absolute; bottom: 0; right: 0; background: var(--primary); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 3px solid var(--bg-card);">
                                        <i class="fas fa-camera" style="color: white; font-size: 0.9rem;"></i>
                                    </label>
                                    <input type="file" id="avatar-upload" style="display: none;" accept="image/*">
                                </div>
                                <h3>${user.name}</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 1rem;">${user.email}</p>
                                <p style="font-style: italic; color: var(--text-secondary); line-height: 1.5;">${user.bio || 'No bio yet. Tell us about yourself!'}</p>
                            </div>
                            
                            <div class="card">
                                <h3>Account Settings</h3>
                                <form id="profile-form" style="margin-top: 1.5rem;">
                                    <div class="form-group">
                                        <label class="form-label">Display Name</label>
                                        <input type="text" name="name" class="form-input" value="${user.name}" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Bio (Max 500 chars)</label>
                                        <textarea name="bio" class="form-textarea" rows="4">${user.bio || ''}</textarea>
                                    </div>
                                    <button type="submit" class="btn btn-primary" style="width: 100%;">Update Profile</button>
                                </form>
                            </div>
                        </div>
                        
                        <div style="flex: 2; min-width: 400px;">
                            <h2 style="margin-bottom: 2rem;">My Scripts</h2>
                            <div class="grid" style="grid-template-columns: 1fr;">
                                ${data.scripts.length > 0 ?
                    data.scripts.map(s => `
                                        <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem;">
                                            <div>
                                                <h4 style="margin-bottom: 0.5rem;">${s.title}</h4>
                                                <span style="font-size: 0.85rem; color: var(--text-secondary);">
                                                    ${new Date(s.createdAt).toLocaleDateString()} &bull; ${s.genre || 'Other'} &bull; ${s.status}
                                                </span>
                                            </div>
                                            <a href="/scripts/${s._id}" class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="route(event, '/scripts/${s._id}')">View</a>
                                        </div>
                                    `).join('')
                    : '<p>You haven\'t uploaded any scripts yet.</p>'
                }
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Avatar Upload listener
            document.getElementById('avatar-upload').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('avatar', file);
                formData.append('name', user.name);
                formData.append('bio', user.bio || '');

                try {
                    const res = await fetch('/api/user/profile', {
                        method: 'POST',
                        body: formData
                    });
                    const resData = await res.json();
                    if (resData.success) {
                        Components.toast('Avatar updated!');
                        state.user = resData.user;
                        renderProfile();
                    } else {
                        Components.toast(resData.message || 'Error uploading avatar', 'error');
                    }
                } catch (err) {
                    Components.toast('An error occurred during upload', 'error');
                }
            });

            // Profile Form listener
            document.getElementById('profile-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);

                try {
                    const res = await api.post('/api/user/profile', data);
                    if (res.success) {
                        Components.toast('Profile updated successfully!');
                        state.user = res.user;
                        renderProfile();
                    } else {
                        Components.toast(res.message || 'Error updating profile', 'error');
                    }
                } catch (err) {
                    Components.toast('An error occurred', 'error');
                }
            });
        }
    } catch (e) {
        Components.toast('Error loading profile', 'error');
    }
}

async function renderScriptEdit(id) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="container" style="padding-top: 120px;">${Components.loader()}</div>`;

    try {
        const data = await api.get(`/api/scripts/${id}`);
        if (data.success) {
            const script = data.script;
            main.innerHTML = `
                <div class="container" style="padding-top: 120px;">
                    <div class="form-container" style="margin: 0 auto; max-width: 800px;">
                        <h2 style="margin-bottom: 2rem;">Edit Script</h2>
                        <form id="edit-script-form">
                            <div class="form-group">
                                <label class="form-label">Title</label>
                                <input type="text" name="title" class="form-input" value="${script.title}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description</label>
                                <textarea name="description" class="form-textarea" rows="4" required>${script.description}</textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Genre</label>
                                <select name="genre" class="form-input" required>
                                    <option value="Drama" ${script.genre === 'Drama' ? 'selected' : ''}>Drama</option>
                                    <option value="Comedy" ${script.genre === 'Comedy' ? 'selected' : ''}>Comedy</option>
                                    <option value="Sci-Fi" ${script.genre === 'Sci-Fi' ? 'selected' : ''}>Sci-Fi</option>
                                    <option value="Horror" ${script.genre === 'Horror' ? 'selected' : ''}>Horror</option>
                                    <option value="Thriller" ${script.genre === 'Thriller' ? 'selected' : ''}>Thriller</option>
                                    <option value="Romance" ${script.genre === 'Romance' ? 'selected' : ''}>Romance</option>
                                    <option value="Action" ${script.genre === 'Action' ? 'selected' : ''}>Action</option>
                                    <option value="Documentary" ${script.genre === 'Documentary' ? 'selected' : ''}>Documentary</option>
                                    <option value="Short Film" ${script.genre === 'Short Film' ? 'selected' : ''}>Short Film</option>
                                    <option value="Other" ${script.genre === 'Other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            <div style="display: flex; gap: 1rem;">
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">Page Count</label>
                                    <input type="number" name="pageCount" class="form-input" value="${script.pageCount || 0}">
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">Language</label>
                                    <input type="text" name="language" class="form-input" value="${script.language || 'English'}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Script Content</label>
                                <textarea name="content" class="form-textarea" rows="15" required>${script.content}</textarea>
                            </div>
                            <div class="form-group">
                                <label style="color: var(--text-secondary);">
                                    <input type="checkbox" name="isPremiumOnly" ${script.isPremiumOnly ? 'checked' : ''}> Premium Only
                                </label>
                            </div>
                            <div style="display: flex; gap: 1rem;">
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                                <button type="button" class="btn btn-outline" onclick="renderScriptDetail('${script._id}')">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.getElementById('edit-script-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                data.isPremiumOnly = formData.get('isPremiumOnly') === 'on';

                try {
                    const res = await api.post(`/api/scripts/${script._id}/edit`, data);
                    if (res.success) {
                        Components.toast('Script updated successfully!');
                        renderScriptDetail(script._id);
                    } else {
                        Components.toast(res.message || 'Error updating script', 'error');
                    }
                } catch (err) {
                    Components.toast('An error occurred', 'error');
                }
            });
        }
    } catch (e) {
        Components.toast('Error loading script', 'error');
    }
}

async function renderCreateScript() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="container" style="padding-top: 120px;">
            <div class="form-container" style="margin: 0 auto; max-width: 800px;">
                <h2 style="margin-bottom: 2rem;">Upload Script</h2>
                <form id="create-script-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" name="title" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-textarea" rows="4" required></textarea>
                    </div>
                    
                    <!-- Genre Selection -->
                    <div class="form-group">
                        <label class="form-label">Genre</label>
                        <select name="genre" class="form-input" required>
                            <option value="Other">Other</option>
                            <option value="Drama">Drama</option>
                            <option value="Comedy">Comedy</option>
                            <option value="Sci-Fi">Sci-Fi</option>
                            <option value="Horror">Horror</option>
                            <option value="Thriller">Thriller</option>
                            <option value="Romance">Romance</option>
                            <option value="Action">Action</option>
                            <option value="Documentary">Documentary</option>
                            <option value="Short Film">Short Film</option>
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 1rem;">
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">Page Count</label>
                            <input type="number" name="pageCount" class="form-input" min="0" placeholder="0">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">Language</label>
                            <input type="text" name="language" class="form-input" value="English">
                        </div>
                    </div>
                    
                    <!-- Toggle between file upload and text input -->
                    <div class="form-group">
                        <label style="color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="use-file-upload"> Upload from file (.txt, .pdf, .md)
                        </label>
                    </div>
                    
                    <div class="form-group" id="content-text-group">
                        <label class="form-label">Script Content</label>
                        <textarea name="content" id="content-textarea" class="form-textarea" rows="10"></textarea>
                    </div>
                    
                    <div class="form-group" id="content-file-group" style="display: none;">
                        <label class="form-label">Upload Script File</label>
                        <input type="file" name="scriptFile" id="script-file" class="form-input" accept=".txt,.pdf,.md">
                    </div>
                    
                    <div class="form-group">
                        <label style="color: var(--text-secondary);">
                            <input type="checkbox" name="isPremiumOnly"> Premium Only
                        </label>
                    </div>
                    <button type="submit" class="btn btn-primary">Publish Script</button>
                </form>
            </div>
        </div>
    `;

    // Toggle between file and text input
    const useFileUpload = document.getElementById('use-file-upload');
    const contentTextGroup = document.getElementById('content-text-group');
    const contentFileGroup = document.getElementById('content-file-group');
    const contentTextarea = document.getElementById('content-textarea');
    const scriptFileInput = document.getElementById('script-file');

    useFileUpload.addEventListener('change', (e) => {
        if (e.target.checked) {
            contentTextGroup.style.display = 'none';
            contentFileGroup.style.display = 'block';
            contentTextarea.removeAttribute('required');
            scriptFileInput.setAttribute('required', 'required');
        } else {
            contentTextGroup.style.display = 'block';
            contentFileGroup.style.display = 'none';
            contentTextarea.setAttribute('required', 'required');
            scriptFileInput.removeAttribute('required');
        }
    });

    document.getElementById('create-script-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Set isPremiumOnly properly
        if (formData.get('isPremiumOnly') === 'on') {
            formData.set('isPremiumOnly', 'true');
        } else {
            formData.delete('isPremiumOnly');
            formData.set('isPremiumOnly', 'false');
        }

        try {
            const res = await fetch('/api/scripts/create', {
                method: 'POST',
                body: formData
                // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
            });

            const data = await res.json();

            if (data.success) {
                Components.toast('Script published!');
                window.history.pushState({}, "", '/scripts');
                renderScripts();
            } else {
                Components.toast(data.message || 'Failed to publish', 'error');
            }
        } catch (err) {
            console.error('Upload error:', err);
            Components.toast('Error publishing script', 'error');
        }
    });
}

function renderPremium() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="container" style="padding-top: 120px; text-align: center;">
             <h1 class="text-gradient" style="font-size: 3rem; margin-bottom: 2rem;">Nova Premium</h1>
             <p style="font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 3rem;">Unlock exclusive scripts and advanced features.</p>
             
             <div class="grid">
                <div class="card">
                    <h2>Monthly</h2>
                    <h1 class="text-gradient">$9.99</h1>
                    <p>per month</p>
                     <button class="btn btn-primary" style="margin-top: 2rem; width: 100%;">Subscribe</button>
                </div>
                 <div class="card" style="border-color: var(--primary);">
                    <h2>Annual</h2>
                    <h1 class="text-gradient">$99.99</h1>
                    <p>per year</p>
                    <button class="btn btn-primary" style="margin-top: 2rem; width: 100%;">Subscribe</button>
                </div>
             </div>
        </div>
    `;
}

async function logout() {
    await fetch('/api/auth/logout');
    state.user = null;
    state.isAuthenticated = false;
    updateNavbar();
    Components.toast('Logged out');
    window.history.pushState({}, "", '/');
    renderHome();
}

// Theme Management
function initTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.querySelector('.theme-toggle i');
    if (btn) {
        btn.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// Script Management Functions
async function deleteScript(id) {
    if (!confirm('Are you sure you want to delete this script? This action cannot be undone.')) {
        return;
    }

    try {
        const res = await api.post(`/api/scripts/${id}/delete`);
        if (res.success) {
            Components.toast('Script deleted successfully');
            window.history.pushState({}, "", '/scripts');
            renderScripts();
        } else {
            Components.toast(res.message || 'Failed to delete script', 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        Components.toast('Error deleting script', 'error');
    }
}

function editScript(id) {
    renderScriptEdit(id);
}

// Focus Mode for Reading
function toggleFocusMode() {
    document.body.classList.toggle('focus-mode');
    const navbar = document.getElementById('navbar');
    const footer = document.getElementById('footer');

    if (document.body.classList.contains('focus-mode')) {
        navbar.style.display = 'none';
        footer.style.display = 'none';
        const focusBtn = document.querySelector('.script-content').parentElement.querySelector('button');
        if (focusBtn) {
            focusBtn.innerHTML = '<i class="fas fa-compress"></i> Exit Focus Mode';
        }
    } else {
        navbar.style.display = '';
        footer.style.display = '';
        const focusBtn = document.querySelector('.script-content').parentElement.querySelector('button');
        if (focusBtn) {
            focusBtn.innerHTML = '<i class="fas fa-expand"></i> Focus Mode';
        }
    }
}

// Global scope
window.route = route;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.deleteScript = deleteScript;
window.editScript = editScript;
window.renderScriptEdit = renderScriptEdit;
window.toggleFocusMode = toggleFocusMode;

// Init
window.addEventListener('DOMContentLoaded', () => {
    init();
    initTheme();
});
