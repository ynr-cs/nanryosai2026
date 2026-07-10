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
  onSnapshot,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const AppShell = {
  // ホワイトリスト: フッターとアンケートバナーを表示するページのパス部分
  FOOTER_WHITELIST: [
    "404.html",
    "about.html",
    "about-us.html",
    "account.html",
    "detail.html",
    "index.html",
    "map.html",
    "mobile-order-guide.html",
    "privacy.html",
    "projects-list.html",
    "stage-list.html",
    "terms.html",
    "status.html", // pos/status.html
  ],

  isFooterPage: function () {
    const path = window.location.pathname;
    // パスの末尾のファイル名を取り出して完全一致で判定（誤マッチ防止）
    const filename = path.split("/").pop() || "";
    return this.FOOTER_WHITELIST.includes(filename);
  },

  init: function () {
    this.injectStyles();
    this.injectHeader();
    this.injectBottomNav();
    this.injectMenuOverlay();
    this.injectFooter();
    this.highlightActiveTab();
    this.initAuth();
    this.initTheme(); // Initialize manual theme override
    this.updateVersionDisplay(); // Fetch and display version from CHANGELOG
    this.initGlobalAlert();
  },

  initGlobalAlert: function () {
    onSnapshot(doc(db, "_metadata", "system_alerts"), (snap) => {
      const existingAlert = document.getElementById("main-global-alert");
      if (existingAlert) {
        existingAlert.remove();
      }

      if (snap.exists()) {
        const data = snap.data();
        if (data.mainAlertActive && data.mainAlertMessage) {
          let bgColor = "var(--danger-color, #ef4444)";
          let icon = "bi-exclamation-triangle-fill";
          if (data.mainAlertType === "warning") {
            bgColor = "#f59e0b";
            icon = "bi-exclamation-circle-fill";
          } else if (data.mainAlertType === "info") {
            bgColor = "#3b82f6";
            icon = "bi-info-circle-fill";
          }

          const alertHtml = `
            <div id="main-global-alert" style="
              background-color: ${bgColor};
              color: white;
              padding: 10px 16px;
              font-size: 0.9rem;
              font-weight: bold;
              text-align: center;
              position: sticky;
              top: calc(var(--header-height, 60px) + var(--safe-area-top, 0px));
              z-index: 800;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            ">
              <i class="bi ${icon}"></i>
              <span>${data.mainAlertMessage.replace(/\n/g, "<br>")}</span>
            </div>
          `;
          
          const header = document.querySelector(".app-header");
          if (header) {
            header.insertAdjacentHTML("afterend", alertHtml);
          } else {
            document.body.insertAdjacentHTML("afterbegin", alertHtml);
          }
        }
      }
    });
  },

  resolvePath: function (path) {
    // Dynamically determine the base URL using this script's location
    // import.meta.url is absolute (e.g., https://.../main/app-shell.js)
    const mainBaseUrl = new URL(".", import.meta.url).href;
    const posBaseUrl = new URL("../pos/", import.meta.url).href;

    if ((path.includes("mobile-order") && !path.includes("guide")) || path.includes("status.html")) {
      return new URL(path, posBaseUrl).href;
    } else {
      return new URL(path, mainBaseUrl).href;
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
            "completed",
            "cancelled",
            "abandoned",
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

  injectFooter: function () {
    // ホワイトリスト外のページではフッターを表示しない
    if (!this.isFooterPage()) return;
    if (document.querySelector(".app-footer")) return;

    const csForm = "https://docs.google.com/forms/d/e/1FAIpQLSf_QdSMyrFXiZ28U50DlPoK0umuMXnkFDGzu8gWKDY8KUKqRg/viewform?usp=header";
    const surveyForm = "https://docs.google.com/forms/d/e/1FAIpQLSeCqNNdr9NFcosejNj0acvD7MSqFfmgOQIAVad_Ss1YV-Sh9A/viewform?usp=header";
    const bugForm = "https://docs.google.com/forms/d/e/1FAIpQLSf7PQQPMjnIGnzr_dYKwudQllR7w0b9poia4n7XI_ktmkgkOQ/viewform?usp=header";
    // TODO: 人気投票フォームURL判明次第、下記を更新する
    const voteUrl = this.resolvePath("404.html");

    const footerHtml = `
      <footer class="app-footer" id="app-footer">

        <!-- サイトマップ（4カラム） -->
        <nav class="footer-sitemap">

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">イベント</div>
            <ul class="footer-sitemap-list">
              <li><a href="${this.resolvePath("about.html")}">概要</a></li>
              <li><a href="${this.resolvePath("projects-list.html")}">企画一覧</a></li>
              <li><a href="${this.resolvePath("stage-list.html")}">ステージ発表</a></li>
              <li><a href="${this.resolvePath("map.html")}">校内マップ</a></li>
            </ul>
          </div>

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">サービス</div>
            <ul class="footer-sitemap-list">
              <li><a href="${this.resolvePath("mobile-order-guide.html")}">モバイルオーダーガイド</a></li>
              <li><a href="${this.resolvePath("mobile-order.html")}">モバイルオーダー</a></li>
            </ul>
          </div>

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">サポート</div>
            <ul class="footer-sitemap-list">
              <li>
                <a href="${csForm}" target="_blank" rel="noopener">
                  お問い合わせ<i class="bi bi-box-arrow-up-right ext-icon"></i>
                </a>
              </li>
              <li>
                <a href="${bugForm}" target="_blank" rel="noopener">
                  不具合報告<i class="bi bi-box-arrow-up-right ext-icon"></i>
                </a>
              </li>
              <li><a href="${this.resolvePath("terms.html")}">利用規約</a></li>
              <li><a href="${this.resolvePath("privacy.html")}">プライバシーポリシー</a></li>
            </ul>
          </div>

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">コンピュータ科学部</div>
            <ul class="footer-sitemap-list">
              <li><a href="${this.resolvePath("about-us.html")}">コンピュータ科学部について</a></li>
            </ul>
            <div class="footer-sns-row">
              <a href="https://github.com/ynr-cs/nanryosai2026"
                 class="footer-sns-btn github"
                 target="_blank" rel="noopener" title="GitHub">
                <i class="bi bi-github"></i>
              </a>
              <a href="https://www.instagram.com/ynr_cs"
                 class="footer-sns-btn instagram"
                 target="_blank" rel="noopener" title="Instagram">
                <i class="bi bi-instagram"></i>
              </a>
            </div>
          </div>

        </nav>

        <!-- フッター内アンケートカード -->
        <div class="footer-survey-row">
          <a class="footer-survey-card" href="${surveyForm}" target="_blank" rel="noopener">
            <div class="footer-survey-icon"><i class="bi bi-ui-checks"></i></div>
            <div class="footer-survey-body">
              <span class="footer-survey-label">コンピュータ科学部 アンケート</span>
              <span class="footer-survey-title">サイトへのご意見・感想</span>
            </div>
            <i class="bi bi-chevron-right footer-survey-arrow"></i>
          </a>
          <!-- TODO: 人気投票フォームURL判明次第、voteUrlを更新する -->
          <a class="footer-survey-card" href="${voteUrl}" rel="noopener">
            <div class="footer-survey-icon trophy"><i class="bi bi-trophy-fill"></i></div>
            <div class="footer-survey-body">
              <span class="footer-survey-label">生徒会 人気投票</span>
              <span class="footer-survey-title">あなたの推し企画に投票！</span>
            </div>
            <i class="bi bi-chevron-right footer-survey-arrow"></i>
          </a>
        </div>

        <!-- 巨大ロゴ（クリックで文字ウェーブ） -->
        <div class="footer-biglogo-wrap">
          <span class="footer-biglogo" id="footer-biglogo">南陵祭'<span class="glow-26" id="footer-glow26">26</span></span>
        </div>

        <!-- コピーライト -->
        <div class="footer-bottom">
          <span class="footer-bottom-left">
            © 2026 コンピュータ科学部<br>
            <span style="font-size:0.65rem; opacity:0.6;">横浜南陵高等学校 南陵祭2026 公式Webサイト</span>
          </span>
        </div>

      </footer>
    `;

    // ボトムナビの直前に挿入
    const bottomNav = document.querySelector(".app-bottom-nav");
    if (bottomNav) {
      bottomNav.insertAdjacentHTML("beforebegin", footerHtml);
    } else {
      document.body.insertAdjacentHTML("beforeend", footerHtml);
    }

    // ロゴフィット & アニメーション初期化
    this.initFooterLogoFit();
  },

  initFooterLogoFit: function () {
    const logo = document.getElementById("footer-biglogo");
    if (!logo) return;

    function fitBigLogo() {
      const wrap = logo.parentElement;
      logo.style.transform = "scaleX(1)";
      const wrapW = wrap.clientWidth - 32;
      const logoW = logo.scrollWidth;
      if (logoW > 0) {
        const sx = wrapW / logoW;
        logo.style.transform = `scaleX(${sx})`;
        logo.style.transformOrigin = "left center";
      }
    }

    fitBigLogo();
    window.addEventListener("resize", fitBigLogo);

    // 文字ウェーブ アニメーション
    function splitIntoChars() {
      if (logo.querySelector(".char")) return;
      const walker = document.createTreeWalker(logo, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);
      textNodes.forEach((tn) => {
        const parent = tn.parentNode;
        const frag = document.createDocumentFragment();
        [...tn.textContent].forEach((ch) => {
          const span = document.createElement("span");
          span.className = "char";
          span.textContent = ch;
          frag.appendChild(span);
        });
        parent.replaceChild(frag, tn);
      });
    }

    let waving = false;
    logo.addEventListener("click", () => {
      if (waving) return;
      waving = true;
      splitIntoChars();
      const chars = logo.querySelectorAll(".char");
      const stagger = 42;
      chars.forEach((ch, i) => {
        ch.classList.remove("animating");
        void ch.offsetWidth;
        ch.style.animationDelay = `${i * stagger}ms`;
        ch.classList.add("animating");
      });
      const totalDuration = (chars.length - 1) * stagger + 700;
      setTimeout(() => {
        chars.forEach((ch) => {
          ch.classList.remove("animating");
          ch.style.animationDelay = "";
        });
        waving = false;
      }, totalDuration + 50);
    });
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

                    <div class="menu-footer" style="text-align: center; padding: 20px 0;">
                        <a href="${this.resolvePath("about-us.html")}" class="menu-footer-link" style="opacity: 0.8; text-decoration: none; color: inherit; font-size: 0.85rem;">
                            Powered By コンピュータ科学部
                        </a>
                        <div id="app-version-display" style="font-size: 0.7rem; color: var(--text-sub); margin-top: 4px; opacity: 0.5; display: none;"></div>
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

  updateVersionDisplay: async function () {
    try {
      // Fetch CHANGELOG.md from the root directory
      const response = await fetch(this.resolvePath("../CHANGELOG.md"));
      if (!response.ok) return;
      const text = await response.text();
      // Match the first version pattern: ## [x.y.z]
      const match = text.match(/## \[([\d\.]+)\]/);
      if (match && match[1]) {
        const versionEl = document.getElementById("app-version-display");
        if (versionEl) {
          versionEl.textContent = `v${match[1]}`;
          versionEl.style.display = "block";
        }
      }
    } catch (e) {
      console.warn("Failed to fetch version from CHANGELOG.md", e);
    }
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
        "completed",
        "cancelled",
        "abandoned",
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
