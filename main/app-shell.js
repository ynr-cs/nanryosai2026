/**
 * Nanryosai Super App - App Shell
 * Handles the injection of global Header, Bottom Navigation, and Authentication state.
 */

// Import Auth Logic
import { login, logout, watchUser } from "./auth.js";

const AppShell = {
    init: function() {
        this.injectStyles();
        this.injectHeader();
        this.injectBottomNav();
        this.injectMenuOverlay();
        this.highlightActiveTab();
        this.initAuth();
    },

    resolvePath: function(path) {
        const inPos = window.location.pathname.includes('/pos/');
        
        if (path.includes('mobile-order')) {
            if (inPos) return 'mobile-order.html'; 
            return '../pos/mobile-order.html'; 
        } else {
            if (inPos) return '../main/' + path;
            return path; 
        }
    },

    injectStyles: function() {
        // Core Style
        const existingLink = document.querySelector('link[href*="style.css"]');
        if (!existingLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = this.resolvePath('style.css');
            document.head.appendChild(link);
        }

        // Bootstrap Icons (if not present)
        const biLink = document.querySelector('link[href*="bootstrap-icons.css"]');
        if (!biLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css';
            document.head.appendChild(link);
        }
    },

    injectHeader: function() {
        if (document.querySelector('.app-header')) return; 

        // Header with Hamburger Menu
        const headerHtml = `
            <header class="app-header">
                <a href="${this.resolvePath('index.html')}" class="app-logo">南陵祭'26</a>
                <div class="header-actions">
                    <button class="menu-btn" id="header-menu-btn" aria-label="Menu">
                        <i class="bi bi-list" style="font-size: 1.8rem;"></i>
                    </button>
                </div>
            </header>
        `;
        document.body.insertAdjacentHTML('afterbegin', headerHtml);

        document.getElementById('header-menu-btn').addEventListener('click', () => {
             this.toggleMenu(true);
        });
    },

    injectBottomNav: function() {
        if (document.querySelector('.app-bottom-nav')) return;

        const navHtml = `
            <nav class="app-bottom-nav">
                <a href="${this.resolvePath('index.html')}" class="nav-item" data-page="home">
                    <i class="bi bi-house-door-fill"></i>
                    <span class="nav-label">ホーム</span>
                </a>
                <a href="${this.resolvePath('projects-list.html')}" class="nav-item" data-page="projects">
                    <i class="bi bi-grid-fill"></i>
                    <span class="nav-label">企画</span>
                </a>
                
                <a href="${this.resolvePath('mobile-order.html')}" class="nav-item core-button" data-page="order">
                    <div class="icon-circle">
                        <i class="bi bi-bag-check-fill" style="font-size: 1.5rem;"></i>
                    </div>
                    <span class="nav-label" style="font-weight: 900; color: var(--primary-color)">オーダー</span>
                </a>

                <a href="${this.resolvePath('stage-list.html')}" class="nav-item" data-page="stage">
                    <i class="bi bi-mic-fill"></i>
                    <span class="nav-label">ステージ</span>
                </a>
                
                <!-- Account / My Page Item with Dynamic Avatar -->
                <a href="${this.resolvePath('account.html')}" class="nav-item" data-page="account">
                    <div id="nav-user-icon-container" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <!-- Default Icon -->
                         <i id="nav-icon-guest" class="bi bi-person-circle" style="font-size: 1.5rem;"></i>
                         <!-- Dynamic Avatar -->
                         <img id="nav-icon-user" class="user-avatar" src="" style="display: none;">
                    </div>
                    <span class="nav-label">アカウント</span>
                </a>
            </nav>
        `;
        document.body.insertAdjacentHTML('beforeend', navHtml);
    },
    injectMenuOverlay: function() {
        if (document.querySelector('.app-menu-overlay')) return;

        const menuHtml = `
            <div class="app-menu-overlay" id="app-menu-overlay">
                <div class="app-menu-content">
                    <div class="menu-header">
                        <span>MENU</span>
                        <div onclick="document.getElementById('app-menu-overlay').classList.remove('active')" style="cursor:pointer; padding: 10px;">✕</div>
                    </div>
                    <ul class="menu-list">
                        <li><a href="${this.resolvePath('about.html')}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">ℹ️</span> 概要
                        </a></li>
                        <li><a href="${this.resolvePath('projects-list.html')}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🎪</span> 企画一覧
                        </a></li>
                        <li><a href="${this.resolvePath('stage-list.html')}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🎤</span> ステージ発表
                        </a></li>
                        <li><a href="${this.resolvePath('map.html')}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🗺️</span> 校内マップ
                        </a></li>
                        <li><a href="${this.resolvePath('access.html')}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🚃</span> アクセス
                        </a></li>
                    </ul>

                    <div style="margin-top: auto;">
                        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-bottom: 20px;">
                            <a href="${this.resolvePath('about-us.html')}" style="display: block; padding: 15px; background: #f8f9fa; border-radius: 15px; text-decoration: none; color: #333; font-weight: bold; border: 1px solid #eee;">
                                <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">Created by</div>
                                💻 Computer Science Club
                            </a>
                        </div>
                        <p style="font-size: 0.8rem; color: #999; text-align: center;">© Nanryosai Exe 2026</p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', menuHtml);

        // Click outside to close
        document.getElementById('app-menu-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'app-menu-overlay') {
                this.toggleMenu(false);
            }
        });
    },

    toggleMenu: function(show) {
        const overlay = document.getElementById('app-menu-overlay');
        if (show) overlay.classList.add('active');
        else overlay.classList.remove('active');
    },

    highlightActiveTab: function() {
        let currentPage = window.CURRENT_PAGE;
        if (!currentPage) {
            const path = window.location.pathname;
            if (path.includes('index')) currentPage = 'home';
            else if (path.includes('projects')) currentPage = 'projects';
            else if (path.includes('stage')) currentPage = 'stage';
            else if (path.includes('account')) currentPage = 'account';
            else if (path.includes('mobile-order')) currentPage = 'order';
        }

        if (currentPage) {
            const activeItem = document.querySelector(`.nav-item[data-page="${currentPage}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
    },

    initAuth: function() {
        const guestIcon = document.getElementById('nav-icon-guest');
        const userImg = document.getElementById('nav-icon-user');
        
        // Watch for auth changes and update BOTTOM NAV icon
        watchUser((user) => {
            if (user && user.photoURL) {
                userImg.src = user.photoURL;
                userImg.style.display = 'block';
                if (guestIcon) guestIcon.style.display = 'none';
            } else {
                userImg.style.display = 'none';
                if (guestIcon) guestIcon.style.display = 'block';
            }
        });
    },

    showToast: function(message, isError = false) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        if (isError) toast.style.borderLeft = '4px solid #ff4757';
        else toast.style.borderLeft = '4px solid #2ed573';
        
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};


// Ensure init runs even if module is loaded after DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppShell.init());
} else {
    AppShell.init();
}
