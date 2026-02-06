/**
 * Nanryosai 2026
 * Version: 0.1.0
 * Last Modified: 2026-02-05
 * Author: Nanryosai 2026 Project Team
 */

/**
 * Nanryosai Super App - App Shell
 * Handles the injection of global Header, Bottom Navigation, and Authentication state.
 */

// Import Auth Logic
// Import Auth Logic
import { login, logout, watchUser, db, getCurrentUser } from "./auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const AppShell = {
  init: function () {
    this.injectStyles();
    this.injectHeader();
    this.injectBottomNav();
    this.injectMenuOverlay();
    this.highlightActiveTab();
    this.initAuth();
    this.initTheme(); // Initialize manual theme override
  },

  resolvePath: function (path) {
    const inPos = window.location.pathname.includes("/pos/");

    if (path.includes("mobile-order")) {
      if (inPos) return "mobile-order.html";
      return "../pos/mobile-order.html";
    } else {
      if (inPos) return "../main/" + path;
      return path;
    }
  },

  injectStyles: function () {
    // Core Style
    const existingLink = document.querySelector('link[href*="style.css"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = this.resolvePath("style.css");
      document.head.appendChild(link);
    }

    // Bootstrap Icons (if not present)
    const biLink = document.querySelector('link[href*="bootstrap-icons.css"]');
    if (!biLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css";
      document.head.appendChild(link);
    }
  },

  injectHeader: function () {
    if (document.querySelector(".app-header")) return;

    // Header with Hamburger Menu
    const headerHtml = `
            <header class="app-header">
                <a href="${this.resolvePath("index.html")}" class="app-logo">南陵祭'26</a>
                <div class="header-actions">
                    <button class="menu-btn" id="header-menu-btn" aria-label="Menu">
                        <i class="bi bi-list" style="font-size: 1.8rem;"></i>
                    </button>
                </div>
            </header>
        `;
    document.body.insertAdjacentHTML("afterbegin", headerHtml);

    document.getElementById("header-menu-btn").addEventListener("click", () => {
      this.toggleMenu(true);
    });
  },

  injectBottomNav: function () {
    if (document.querySelector(".app-bottom-nav")) return;

    const navHtml = `
            <nav class="app-bottom-nav">
                <a href="${this.resolvePath("index.html")}" class="nav-item" data-page="home">
                    <i class="bi bi-house-door-fill"></i>
                    <span class="nav-label">ホーム</span>
                </a>
                <a href="${this.resolvePath("projects-list.html")}" class="nav-item" data-page="projects">
                    <i class="bi bi-grid-fill"></i>
                    <span class="nav-label">企画</span>
                </a>
                
                <a href="${this.resolvePath("mobile-order.html")}" class="nav-item core-button" data-page="order">
                    <div class="icon-circle" style="position: relative;">
                        <i class="bi bi-bag-check-fill" style="font-size: 1.5rem;"></i>
                        <span id="order-nav-badge" class="nav-notification-badge" style="display: none;"></span>
                    </div>
                    <span class="nav-label" style="font-weight: 900; color: var(--primary-color)">オーダー</span>
                </a>

                <a href="${this.resolvePath("stage-list.html")}" class="nav-item" data-page="stage">
                    <i class="bi bi-mic-fill"></i>
                    <span class="nav-label">ステージ</span>
                </a>
                
                <!-- Account / My Page Item with Dynamic Avatar -->
                <a href="${this.resolvePath("account.html")}" class="nav-item" data-page="account">
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
    document.body.insertAdjacentHTML("beforeend", navHtml);

    // Smart Navigation for Order Tab
    const orderBtn = document.querySelector('.nav-item[data-page="order"]');
    if (orderBtn) {
      orderBtn.addEventListener("click", async (e) => {
        const user = getCurrentUser();
        // Only intercept if user is logged in
        if (!user) return;

        e.preventDefault();
        const targetHref = orderBtn.getAttribute("href");

        // Show simple feedback (optional, but good for async)
        const originalIcon = orderBtn.querySelector(".icon-circle").innerHTML;
        orderBtn.querySelector(".icon-circle").innerHTML =
          '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="color:var(--primary-color)"></span>';

        try {
          const completedStatuses = [
            "completed_at_store",
            "completed_online",
            "cancelled",
            "abandoned_and_paid",
          ];

          // Query latest 5 orders to check for active ones
          // Uses same potential index as account.html
          const q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(5),
          );

          const snap = await getDocs(q);
          let activeOrder = null;

          for (const doc of snap.docs) {
            const data = doc.data();
            if (!completedStatuses.includes(data.status)) {
              activeOrder = doc.id;
              break;
            }
          }

          if (activeOrder) {
            const inPos = window.location.pathname.includes("/pos/");
            const statusPath = inPos
              ? `status.html?orderId=${activeOrder}`
              : `../pos/status.html?orderId=${activeOrder}`;
            window.location.href = statusPath;
          } else {
            window.location.href = targetHref;
          }
        } catch (err) {
          console.error("Smart Nav Error:", err);
          window.location.href = targetHref; // Fallback
        } finally {
          // Restore icon if navigation doesn't happen immediately (or if we stay on page)
          setTimeout(() => {
            if (orderBtn.querySelector(".icon-circle")) {
              orderBtn.querySelector(".icon-circle").innerHTML = originalIcon;
            }
          }, 2000); // 2s timeout just in case
        }
      });
    }
  },

  initTheme: function () {
    const savedTheme = localStorage.getItem("app-theme") || "auto";
    this.applyTheme(savedTheme);
  },

  applyTheme: function (theme) {
    const html = document.documentElement;
    if (theme === "dark") {
      html.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
      html.setAttribute("data-theme", "light");
    } else {
      html.removeAttribute("data-theme");
    }
    localStorage.setItem("app-theme", theme);

    // Update UI state in menu if it exists
    const btns = document.querySelectorAll(".theme-toggle-btn");
    btns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    });
  },

  injectMenuOverlay: function () {
    if (document.querySelector(".app-menu-overlay")) return;

    const currentTheme = localStorage.getItem("app-theme") || "auto";

    const menuHtml = `
            <div class="app-menu-overlay" id="app-menu-overlay">
                <div class="app-menu-content">
                    <div class="menu-header">
                        <span>MENU</span>
                        <div onclick="document.getElementById('app-menu-overlay').classList.remove('active')" style="cursor:pointer; padding: 10px;">✕</div>
                    </div>
                    
                    <!-- Theme Selector -->
                    <div class="menu-section">
                        <div class="section-label">テーマ設定</div>
                        <div class="theme-selector-grid">
                            <button class="theme-toggle-btn ${currentTheme === "light" ? "active" : ""}" data-theme="light">
                                <i class="bi bi-sun-fill"></i> ライト
                            </button>
                            <button class="theme-toggle-btn ${currentTheme === "dark" ? "active" : ""}" data-theme="dark">
                                <i class="bi bi-moon-stars-fill"></i> ダーク
                            </button>
                            <button class="theme-toggle-btn ${currentTheme === "auto" ? "active" : ""}" data-theme="auto">
                                <i class="bi bi-display"></i> 自動
                            </button>
                        </div>
                    </div>

                    <ul class="menu-list">
                        <li><a href="${this.resolvePath("about.html")}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">ℹ️</span> 概要
                        </a></li>
                        <li><a href="${this.resolvePath("projects-list.html")}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🎪</span> 企画一覧
                        </a></li>
                        <li><a href="${this.resolvePath("stage-list.html")}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🎤</span> ステージ発表
                        </a></li>
                        <li><a href="${this.resolvePath("map.html")}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🗺️</span> 校内マップ
                        </a></li>
                        <li><a href="${this.resolvePath("access.html")}">
                            <span style="font-size: 1.2rem; margin-right: 10px;">🚃</span> アクセス
                        </a></li>
                    </ul>

                    <div style="margin-top: auto;">
                        <div style="border-top: 1px solid var(--border-color); padding-top: 20px; margin-bottom: 20px;">
                            <a href="${this.resolvePath("about-us.html")}" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 15px; background: var(--bg-color); border-radius: 12px; text-decoration: none; color: var(--text-main); border: 1px solid var(--border-color); transition: background 0.2s;">
                                <i class="bi bi-lightning-charge-fill" style="color: var(--primary-color);"></i>
                                <span style="font-weight: 700; font-family: var(--font-gothic); font-size: 0.9rem;">Powered By コンピュータ科学部</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", menuHtml);

    // Add event listeners for theme buttons
    document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.applyTheme(btn.dataset.theme);
      });
    });

    // Click outside to close
    document
      .getElementById("app-menu-overlay")
      .addEventListener("click", (e) => {
        if (e.target.id === "app-menu-overlay") {
          this.toggleMenu(false);
        }
      });
  },

  toggleMenu: function (show) {
    const overlay = document.getElementById("app-menu-overlay");
    if (show) overlay.classList.add("active");
    else overlay.classList.remove("active");
  },

  highlightActiveTab: function () {
    let currentPage = window.CURRENT_PAGE;
    if (!currentPage) {
      const path = window.location.pathname;
      if (path.includes("index")) currentPage = "home";
      else if (path.includes("projects")) currentPage = "projects";
      else if (path.includes("stage")) currentPage = "stage";
      else if (path.includes("account")) currentPage = "account";
      else if (path.includes("mobile-order")) currentPage = "order";
    }

    if (currentPage) {
      const activeItem = document.querySelector(
        `.nav-item[data-page="${currentPage}"]`,
      );
      if (activeItem) {
        activeItem.classList.add("active");
      }
    }
  },

  initAuth: function () {
    const guestIcon = document.getElementById("nav-icon-guest");
    const userImg = document.getElementById("nav-icon-user");

    // Watch for auth changes and update BOTTOM NAV icon
    watchUser((user) => {
      if (user && user.photoURL) {
        userImg.src = user.photoURL;
        userImg.style.display = "block";
        if (guestIcon) guestIcon.style.display = "none";

        // Check for active orders after auth is confirmed
        this.checkActiveOrder(user);
      } else {
        userImg.style.display = "none";
        if (guestIcon) guestIcon.style.display = "block";
        // Hide badge if logged out
        const badge = document.getElementById("order-nav-badge");
        if (badge) badge.style.display = "none";
      }
    });
  },

  checkActiveOrder: async function (user) {
    const badge = document.getElementById("order-nav-badge");
    if (!badge) return;

    try {
      const completedStatuses = [
        "completed_at_store",
        "completed_online",
        "cancelled",
        "abandoned_and_paid",
      ];

      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(5), // Check last 5 just in case
      );

      const snap = await getDocs(q);
      let hasActive = false;

      for (const doc of snap.docs) {
        const data = doc.data();
        if (!completedStatuses.includes(data.status)) {
          hasActive = true;
          break;
        }
      }

      if (hasActive) {
        badge.style.display = "block";
        badge.classList.add("animate__animated", "animate__bounceIn");
      } else {
        badge.style.display = "none";
      }
    } catch (e) {
      console.error("Badge Check Error:", e);
    }
  },

  showToast: function (message, isError = false) {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    if (isError) toast.style.borderLeft = "4px solid #ff4757";
    else toast.style.borderLeft = "4px solid #2ed573";

    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
};

// Ensure init runs even if module is loaded after DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AppShell.init());
} else {
  AppShell.init();
}
