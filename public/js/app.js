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
    '/forgot': renderForgot,
    '/admin': renderAdmin,
    '/terms': renderTerms
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
    const protectedRoutes = ['/profile', '/scripts/create', '/premium', '/admin'];
    if (protectedRoutes.includes(path)) {
        if (!state.isAuthenticated) {
            Components.toast('Please login to access this page', 'error');
            window.history.pushState({}, "", '/login');
            renderLogin();
            return;
        }
        if (path === '/admin' && state.user.role !== 'admin') {
            Components.toast('Unauthorized access', 'error');
            window.history.pushState({}, "", '/');
            renderHome();
            return;
        }
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

    // Fetch Posts
    const postsGrid = document.getElementById('posts-grid');
    try {
        const postsData = await api.get('/api/posts');
        if (postsData.success && postsData.posts && postsData.posts.length) {
            postsGrid.innerHTML = postsData.posts.map(p => Components.postCard(p)).join('');
        } else {
            postsGrid.innerHTML = `
                <div class="card">
                    <h3 class="card-title">Welcome to Nova</h3>
                    <p class="card-desc">We are live! Explore the new features.</p>
                </div>
            `;
        }
    } catch (e) {
        postsGrid.innerHTML = '<p style="color: var(--text-secondary);">Unable to load latest updates right now.</p>';
    }
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
            <div class="card" style="margin-bottom: 3rem; padding: 1.5rem; border: 1px solid var(--border); box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="position: relative; margin-bottom: 1.5rem;">
                    <i class="fas fa-search" style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: var(--text-secondary);"></i>
                    <input type="text" id="search-input" class="form-input" placeholder="Search scripts by title, description, or author..." style="padding-left: 3.5rem; border-radius: 12px; height: 55px; font-size: 1.05rem;">
                </div>
                
                <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Filter by Genre:</span>
                    <div class="genre-filters" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="filter-btn active" data-genre="all">All Genres</button>
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
            const hasLiked = state.user && script.likes && script.likes.some(u => u === state.user._id || (u._id && u._id === state.user._id));
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

                        <!-- Content & Download -->
                        <div style="background: var(--bg-card); padding: 2rem; border-radius: 16px; margin-bottom: 2rem; position: relative;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                                <h3 style="margin: 0;">Script Preview</h3>
                                <div style="display: flex; gap: 0.75rem;">
                                    ${state.isAuthenticated ? `
                                        <button class="btn btn-outline" id="like-btn" style="padding: 0.5rem 1rem;">
                                            <i class="fas fa-heart" style="color: ${hasLiked ? 'var(--secondary)' : 'var(--text-secondary)'};"></i>
                                            <span id="likes-count">${script.likesCount || 0}</span>
                                        </button>
                                    ` : `
                                        <button class="btn btn-outline" onclick="route(event, '/login')" style="padding: 0.5rem 1rem;">
                                            <i class="fas fa-heart"></i> Login to react
                                        </button>
                                    `}
                                    <button class="btn btn-outline" onclick="toggleFocusMode()" style="padding: 0.5rem 1rem;">
                                        <i class="fas fa-expand"></i> Focus Mode
                                    </button>
                                    ${state.isAuthenticated ? `
                                        <a href="/api/scripts/${script._id}/download" class="btn btn-primary" style="padding: 0.5rem 1rem; text-decoration: none;" target="_blank">
                                            <i class="fas fa-download"></i> Download PDF
                                        </a>
                                        ${script.downloadUrl ? `
                                            <a href="${script.downloadUrl}" class="btn btn-outline" style="padding: 0.5rem 1rem; text-decoration: none;" target="_blank" rel="noopener">
                                                <i class="fas fa-film"></i> Download Movie
                                            </a>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            </div>
                            
                            ${!state.isAuthenticated ? `
                                <div class="script-content" style="white-space: pre-wrap; font-family: 'Courier Prime', 'Courier New', Courier, monospace; background: var(--bg-dark); padding: 2.5rem; border-radius: 8px; max-height: 400px; overflow: hidden; color: var(--text-primary); border: 1px solid var(--border); line-height: 1.5; mask-image: linear-gradient(to bottom, black 50%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);">
${(script.content || '').substring(0, 1000)}...
                                </div>
                                <div style="text-align: center; margin-top: -80px; position: relative; z-index: 10; padding-bottom: 2rem;">
                                    <div style="background: var(--bg-card); display: inline-block; padding: 2rem; border-radius: 16px; box-shadow: 0 -20px 40px rgba(0,0,0,0.5);">
                                        <h4 style="margin-bottom: 1rem;">Want to read the full script?</h4>
                                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Register as a reader to unlock the complete story and download PDFs.</p>
                                        <button class="btn btn-primary" onclick="route(event, '/register')" style="padding: 0.75rem 2rem; font-size: 1.1rem;">
                                            Read More &rarr;
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <div class="script-content" style="white-space: pre-wrap; font-family: 'Courier Prime', 'Courier New', Courier, monospace; background: var(--bg-dark); padding: 2.5rem; border-radius: 8px; max-height: 800px; overflow-y: auto; color: var(--text-primary); border: 1px solid var(--border); line-height: 1.5;">
${script.content}
                                </div>
                            `}
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

                        <!-- Comments Section -->
                        <div style="background: var(--bg-card); padding: 2rem; border-radius: 16px; margin-top: 2rem;">
                            <h3>Discussion</h3>
                            ${state.isAuthenticated ? `
                                <form id="comment-form" style="margin-top: 1rem;">
                                    <textarea name="text" class="form-textarea" rows="3" placeholder="Share your thoughts..." required></textarea>
                                    <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">Post Comment</button>
                                </form>
                            ` : `
                                <p style="color: var(--text-secondary); margin-top: 1rem;">
                                    <a href="/login" onclick="route(event, '/login')" style="color: var(--primary);">Login</a> to join the discussion.
                                </p>
                            `}
                            <div id="comments-list" style="margin-top: 2rem;">
                                ${(script.comments || []).slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(c => `
                                    <div style="display:flex; gap:1rem; margin-bottom:1rem;">
                                        <div>
                                            <div style="width:36px; height:36px; border-radius:50%; background:var(--bg-dark); display:flex; align-items:center; justify-content:center; font-size:0.9rem;">
                                                ${(c.user && c.user.name ? c.user.name.charAt(0) : 'U').toUpperCase()}
                                            </div>
                                        </div>
                                        <div>
                                            <strong>${c.user ? c.user.name : 'User'}</strong>
                                            <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:0.5rem;">
                                                ${new Date(c.createdAt).toLocaleString()}
                                            </span>
                                            <p style="margin-top:0.25rem;">${c.text}</p>
                                        </div>
                                    </div>
                                `).join('') || '<p style="color: var(--text-secondary);">No comments yet. Be the first to share feedback.</p>'}
                            </div>
                        </div>
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

            // Like button interaction
            const likeBtn = document.getElementById('like-btn');
            if (likeBtn && state.isAuthenticated) {
                likeBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    try {
                        const res = await api.post(`/api/scripts/${script._id}/like`);
                        if (res.success) {
                            const icon = likeBtn.querySelector('i');
                            const countEl = document.getElementById('likes-count');
                            if (icon) {
                                icon.style.color = res.liked ? 'var(--secondary)' : 'var(--text-secondary)';
                            }
                            if (countEl) {
                                countEl.textContent = res.likesCount;
                            }
                        }
                    } catch (err) {
                        Components.toast('Error updating reaction', 'error');
                    }
                });
            }

            // Comment form interaction
            const commentForm = document.getElementById('comment-form');
            if (commentForm && state.isAuthenticated) {
                commentForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(commentForm);
                    const data = Object.fromEntries(formData);
                    if (!data.text || !data.text.trim()) {
                        return Components.toast('Comment cannot be empty', 'error');
                    }
                    try {
                        const res = await api.post(`/api/scripts/${script._id}/comments`, data);
                        if (res.success) {
                            Components.toast('Comment posted!');
                            renderScriptDetail(script._id);
                        } else {
                            Components.toast(res.message || 'Error posting comment', 'error');
                        }
                    } catch (err) {
                        Components.toast('Error posting comment', 'error');
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
            <h2 class="text-gradient" style="text-align: center; margin-bottom: 1.5rem;">Join NextScene Nova</h2>
            
            <div style="display: flex; background: var(--bg-dark); padding: 0.5rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid var(--border);">
                <button type="button" id="type-reader" style="flex: 1; padding: 0.75rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.3s; font-weight: 600; background: var(--primary); color: white;">
                    <i class="fas fa-book-open"></i> I'm a Reader
                </button>
                <button type="button" id="type-writer" style="flex: 1; padding: 0.75rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.3s; font-weight: 600; background: transparent; color: var(--text-secondary);">
                    <i class="fas fa-pen-nib"></i> I'm a Writer
                </button>
            </div>

            <form id="register-form">
                <input type="hidden" name="isWriter" id="is-writer-input" value="false">
                
                <div class="form-group">
                    <label class="form-label">Full Name</label>
                    <input type="text" name="name" class="form-input" placeholder="Enter your full name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Email Address</label>
                    <input type="email" name="email" class="form-input" placeholder="example@email.com" required>
                </div>
                
                <div id="writer-fields" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Phone Number (Worldwide)</label>
                        <input type="tel" name="phoneNumber" id="phone-input" class="form-input" placeholder="+1234567890">
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">Required for identity verification.</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Portfolio / Bio Link (Optional)</label>
                        <input type="url" name="portfolioUrl" class="form-input" placeholder="https://imdb.com/name/...">
                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">Links to your work help speed up verification.</p>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-input" placeholder="Minimum 8 characters" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Confirm Password</label>
                    <input type="password" name="confirmPassword" class="form-input" placeholder="Re-enter password" required>
                </div>

                <div id="writer-note" style="display: none; background: rgba(var(--primary-rgb), 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid var(--primary);">
                    <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">
                        <strong><i class="fas fa-info-circle"></i> Writer Verification</strong><br>
                        Writers are verified by the Super Admin to ensure platform quality. This usually takes 24 hours.
                    </p>
                </div>

                <div class="form-group">
                    <label style="color: var(--text-secondary); font-size: 0.85rem;">
                        <input type="checkbox" name="acceptTerms" id="accept-terms" required>
                        I agree to the <a href="/terms" onclick="route(event, '/terms')" style="color: var(--primary);">Terms &amp; Conditions</a>.
                    </label>
                </div>

                <button type="submit" class="btn btn-primary" id="register-btn" style="width: 100%;">Create Reader Account</button>
            </form>
        </div>
    `;

    const typeReader = document.getElementById('type-reader');
    const typeWriter = document.getElementById('type-writer');
    const writerFields = document.getElementById('writer-fields');
    const writerNote = document.getElementById('writer-note');
    const isWriterInput = document.getElementById('is-writer-input');
    const registerBtn = document.getElementById('register-btn');
    const phoneInput = document.getElementById('phone-input');

    typeReader.onclick = () => {
        typeReader.style.background = 'var(--primary)';
        typeReader.style.color = 'white';
        typeWriter.style.background = 'transparent';
        typeWriter.style.color = 'var(--text-secondary)';
        writerFields.style.display = 'none';
        writerNote.style.display = 'none';
        isWriterInput.value = 'false';
        registerBtn.innerText = 'Create Reader Account';
        phoneInput.removeAttribute('required');
    };

    typeWriter.onclick = () => {
        typeWriter.style.background = 'var(--primary)';
        typeWriter.style.color = 'white';
        typeReader.style.background = 'transparent';
        typeReader.style.color = 'var(--text-secondary)';
        writerFields.style.display = 'block';
        writerNote.style.display = 'block';
        isWriterInput.value = 'true';
        registerBtn.innerText = 'Register as Writer';
        phoneInput.setAttribute('required', 'required');
    };

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
                Components.toast(data.isWriter === 'true' ? 'Writer registration submitted! Awaiting verification.' : 'Welcome to Nova!');
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
                                    <div class="form-group">
                                        <label class="form-label">Personal Website</label>
                                        <input type="url" name="website" class="form-input" value="${user.website || ''}" placeholder="https://yourwebsite.com">
                                    </div>
                                    <div style="display: flex; gap: 1rem;">
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">Twitter/X Handle</label>
                                            <input type="text" name="twitter" class="form-input" value="${user.twitter || ''}" placeholder="@username">
                                        </div>
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">LinkedIn Profile</label>
                                            <input type="text" name="linkedin" class="form-input" value="${user.linkedin || ''}" placeholder="username">
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 1rem;">
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">Phone Number</label>
                                            <input type="tel" name="phoneNumber" class="form-input" value="${user.phoneNumber || ''}" placeholder="+1234567890">
                                        </div>
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">Portfolio Link</label>
                                            <input type="url" name="portfolioUrl" class="form-input" value="${user.portfolioUrl || ''}" placeholder="https://...">
                                        </div>
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

                            <h2 style="margin: 3rem 0 1rem;">My Favorites</h2>
                            <div class="grid" style="grid-template-columns: 1fr;">
                                ${data.profile.favorites && data.profile.favorites.length
                    ? data.profile.favorites.map(s => `
                                        <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem;">
                                            <div>
                                                <h4 style="margin-bottom: 0.5rem;">${s.title}</h4>
                                                <span style="font-size: 0.85rem; color: var(--text-secondary);">
                                                    ${new Date(s.createdAt).toLocaleDateString()} &bull; ${s.genre || 'Other'}
                                                </span>
                                            </div>
                                            <a href="/scripts/${s._id}" class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="route(event, '/scripts/${s._id}')">View</a>
                                        </div>
                                    `).join('')
                    : '<p>You have not favorited any scripts yet.</p>'}
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
             
             <div id="premium-content"></div>
        </div>
    `;

    if (!state.user || !state.user.isPremium) {
        document.getElementById('premium-content').innerHTML = `
            <div class="grid">
                <div class="card">
                    <h2>Monthly</h2>
                    <h1 class="text-gradient">$9.99</h1>
                    <p>per month</p>
                    <button class="btn btn-primary" style="margin-top: 2rem; width: 100%;" id="subscribe-monthly">Subscribe</button>
                </div>
                <div class="card" style="border-color: var(--primary);">
                    <h2>Annual</h2>
                    <h1 class="text-gradient">$99.99</h1>
                    <p>per year</p>
                    <button class="btn btn-primary" style="margin-top: 2rem; width: 100%;" id="subscribe-annual">Subscribe</button>
                </div>
            </div>
        `;

        const handleUpgrade = async (plan) => {
            try {
                const res = await api.post('/api/premium/upgrade', { plan });
                if (res.success) {
                    Components.toast('You are now a premium member!');
                    state.user = res.user;
                    state.isAuthenticated = true;
                    updateNavbar();
                    renderPremium();
                } else {
                    Components.toast(res.message || 'Upgrade failed', 'error');
                }
            } catch (err) {
                Components.toast('Error upgrading to premium', 'error');
            }
        };

        document.getElementById('subscribe-monthly').addEventListener('click', () => handleUpgrade('monthly'));
        document.getElementById('subscribe-annual').addEventListener('click', () => handleUpgrade('annual'));
    } else {
        // Load premium scripts for current premium user
        (async function() {
            try {
                const data = await api.get('/api/premium');
                if (data.success && data.scripts && data.scripts.length) {
                    document.getElementById('premium-content').innerHTML = `
                        <section class="container" style="margin-top: 2rem;">
                            <h2 style="margin-bottom: 1.5rem;">Premium Scripts</h2>
                        <div class="grid">
                            ${data.scripts.map(script => Components.scriptCard(script)).join('')}
                        </div>
                    </section>
                `;
                } else {
                    document.getElementById('premium-content').innerHTML = '<p>No premium scripts available yet.</p>';
                }
            } catch (e) {
                document.getElementById('premium-content').innerHTML = '<p>Error loading premium content.</p>';
            }
        })();
    }
}

async function logout() {
    if (!confirm('Are you sure you want to log out?')) {
        return;
    }

    await fetch('/api/auth/logout');
    state.user = null;
    state.isAuthenticated = false;
    updateNavbar();
    Components.toast('Logged out successfully');
    window.history.pushState({}, "", '/');
    renderHome();
}

// Terms & Conditions static SPA page
function renderTerms() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="container" style="padding-top: 120px; max-width: 800px;">
            <h1 class="text-gradient" style="margin-bottom: 1.5rem;">Terms &amp; Conditions</h1>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                These Terms &amp; Conditions outline the rules and guidelines for using the NextScene Nova platform.
                Replace this placeholder text with your finalized legal terms.
            </p>
            <ul style="color: var(--text-secondary); margin-left: 1.2rem; margin-bottom: 1rem;">
                <li>Users are responsible for the content they upload and must own the necessary rights.</li>
                <li>Premium subscriptions grant time-limited access to exclusive scripts and features.</li>
                <li>Abusive, hateful, or illegal content is strictly prohibited.</li>
            </ul>
            <p style="color: var(--text-secondary);">
                For full legal wording, please consult with a legal professional and update this page accordingly.
            </p>
        </div>
    `;
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

async function renderAdmin() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="container" style="padding-top: 120px;">${Components.loader()}</div>`;

    try {
        const data = await api.get('/api/user/admin/unverified');
        if (data.success) {
            main.innerHTML = `
                <div class="container" style="padding-top: 120px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <h2 class="text-gradient">Admin Dashboard</h2>
                        <span class="badge" style="background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 20px;">
                            ${data.users.length} Pending Verifications
                        </span>
                    </div>

                    <div class="card" style="padding: 0; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead style="background: var(--bg-dark); color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">
                                <tr>
                                    <th style="padding: 1.25rem 2rem;">Writer</th>
                                    <th style="padding: 1.25rem 2rem;">Email</th>
                                    <th style="padding: 1.25rem 2rem;">Phone</th>
                                    <th style="padding: 1.25rem 2rem;">Portfolio</th>
                                    <th style="padding: 1.25rem 2rem;">Joined</th>
                                    <th style="padding: 1.25rem 2rem; text-align: right;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.users.length > 0 ? data.users.map(u => `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 1.25rem 2rem;">
                                            <div style="display: flex; align-items: center; gap: 1rem;">
                                                <img src="${u.avatar || 'https://via.placeholder.com/40'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                                                <strong>${u.name}</strong>
                                            </div>
                                        </td>
                                        <td style="padding: 1.25rem 2rem;">${u.email}</td>
                                        <td style="padding: 1.25rem 2rem;">${u.phoneNumber || 'N/A'}</td>
                                        <td style="padding: 1.25rem 2rem;">
                                            ${u.portfolioUrl ? `<a href="${u.portfolioUrl}" target="_blank" class="text-link">View Portfolio <i class="fas fa-external-link-alt"></i></a>` : 'N/A'}
                                        </td>
                                        <td style="padding: 1.25rem 2rem;">${new Date(u.createdAt).toLocaleDateString()}</td>
                                        <td style="padding: 1.25rem 2rem; text-align: right;">
                                            <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="verifyWriter('${u._id}')">
                                                Verify Writer
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="5" style="padding: 4rem; text-align: center; color: var(--text-secondary);">
                                            <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                                            All writers are currently verified.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        Components.toast('Error loading admin dashboard', 'error');
    }
}

async function verifyWriter(id) {
    if (!confirm('Are you sure you want to verify this writer?')) return;

    try {
        const res = await api.post(`/api/user/admin/verify/${id}`);
        if (res.success) {
            Components.toast(res.message);
            renderAdmin();
        } else {
            Components.toast(res.message || 'Verification failed', 'error');
        }
    } catch (err) {
        Components.toast('An error occurred', 'error');
    }
}

// Global scope
window.route = route;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.deleteScript = deleteScript;
window.editScript = editScript;
window.renderScriptEdit = renderScriptEdit;
window.verifyWriter = verifyWriter;
window.toggleFocusMode = toggleFocusMode;

// Init
window.addEventListener('DOMContentLoaded', () => {
    init();
    initTheme();
});
