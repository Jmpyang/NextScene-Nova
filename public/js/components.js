const Components = {
    navbar: (user) => `
        <div class="container nav-container" style="display: flex; justify-content: space-between; align-items: center;">
            <a href="/" class="nav-logo" onclick="route(event, '/')">
                NextScene <span class="text-gradient">Nova</span>
            </a>
            <ul class="nav-links" style="display: flex; gap: 2rem; align-items: center; list-style: none; margin: 0; padding: 0; flex: 1; justify-content: flex-end;">
                <li><a href="/" class="nav-link" onclick="route(event, '/')">Home</a></li>
                <li><a href="/scripts" class="nav-link" onclick="route(event, '/scripts')">Scripts</a></li>
                <li><a href="/premium" class="nav-link" onclick="route(event, '/premium')">Premium</a></li>
                ${user ? `
                    <li><a href="/profile" class="nav-link" onclick="route(event, '/profile')">Profile</a></li>
                    <li><a href="#" class="btn btn-primary" onclick="logout()">Logout</a></li>
                ` : `
                    <li><a href="/login" class="nav-link" onclick="route(event, '/login')">Login</a></li>
                    <li><a href="/register" class="btn btn-primary" onclick="route(event, '/register')">Get Started</a></li>
                `}
                <li style="margin-left: 1rem; border-left: 1px solid var(--border); padding-left: 1rem;">
                    <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle Theme">
                        <i class="fas fa-moon"></i>
                    </button>
                </li>
            </ul>
        </div>
    `,

    skeletonCard: () => `
        <div class="card skeleton">
            <div class="skeleton-line" style="height: 24px; width: 70%; margin-bottom: 1rem;"></div>
            <div class="skeleton-line" style="height: 16px; width: 100%; margin-bottom: 0.5rem;"></div>
            <div class="skeleton-line" style="height: 16px; width: 90%; margin-bottom: 1rem;"></div>
            <div class="card-meta">
                <div class="skeleton-line" style="height: 14px; width: 30%;"></div>
                <div class="skeleton-line" style="height: 14px; width: 30%;"></div>
            </div>
            <div class="skeleton-line" style="height: 40px; width: 100%; margin-top: 1rem; border-radius: 8px;"></div>
        </div>
    `,

    skeletonLoader: (count = 4) => {
        let skeletons = '';
        for (let i = 0; i < count; i++) {
            skeletons += Components.skeletonCard();
        }
        return skeletons;
    },

    footer: () => `
        <div class="container" style="padding: 4rem 20px; text-align: center; color: var(--text-secondary);">
            <p>&copy; ${new Date().getFullYear()} NextScene Nova. All rights reserved.</p>
        </div>
    `,

    scriptCard: (script) => `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <h3 class="card-title">${script.title}</h3>
                <span class="genre-tag">${script.genre || 'Other'}</span>
            </div>
            <p class="card-desc">${script.description ? script.description.substring(0, 100) + '...' : 'No description available'}</p>
            <div class="card-meta">
                <span><i class="fas fa-calendar"></i> ${new Date(script.createdAt).toLocaleDateString()}</span>
                <span><i class="fas fa-file-alt"></i> ${script.pageCount || 0} pages</span>
                <span><i class="fas fa-language"></i> ${script.language || 'English'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0;">
                <div class="rating-stars">
                    ${Components.renderStars(script.averageRating || 0)}
                </div>
                <span style="color: var(--text-secondary); font-size: 0.9rem;">(${script.totalRatings || 0} ratings)</span>
            </div>
            <div class="card-meta" style="margin-top: 0.5rem;">
                <span><i class="fas fa-user"></i> ${script.author ? script.author.name : 'Unknown'}</span>
            </div>
            <a href="/scripts/${script._id}" class="btn ${script.isPremiumOnly ? 'btn-primary' : 'btn-outline'}" style="width: 100%; margin-top: 1rem; text-align: center;" onclick="route(event, '/scripts/${script._id}')">
                ${script.isPremiumOnly ? '<i class="fas fa-lock"></i> Unlock' : '<i class="fas fa-book-open"></i> Read Now'}
            </a>
        </div>
    `,

    postCard: (post) => `
        <div class="card">
            <h3 class="card-title">${post.title}</h3>
            <p class="card-desc">${post.excerpt}</p>
            <div class="card-meta">
                <span>${new Date(post.publishedAt).toLocaleDateString()}</span>
            </div>
        </div>
    `,

    toast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    renderStars: (rating) => {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star" style="color: gold;"></i>';
        if (halfStar) stars += '<i class="fas fa-star-half-alt" style="color: gold;"></i>';
        for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star" style="color: gold;"></i>';

        return stars;
    },

    loader: () => `<div style="text-align: center; padding: 2rem;"><div class="loader"></div></div>`
};
