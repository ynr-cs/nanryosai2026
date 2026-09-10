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
import { watchUser, db, getCurrentUser } from "./auth.js";
import {
  onSnapshot,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const AppShell = {
  // ホワイトリスト: フッターとアンケートバナーを表示するページのパス部分
  FOOTER_WHITELIST: [
    "404.html",
    "about.html",
    "about-us.html",
    "access.html",
    "account.html",
    "detail.html",
    "index.html",
    "privacy.html",
    "projects-list.html",
    "stage-list.html",
    "terms.html",
    "updates.html",
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
    this.initGlobalAlert();
  },

  initGlobalOrderWatcher: function() {
    // モバイルオーダー休止に伴い停止中
    return;
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
    const biLink = document.querySelector('link[href*="bootstrap-icons"]');
    if (!biLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
      document.head.appendChild(link);
    }
  },

  injectHeader: function () {
    if (document.querySelector(".app-header")) return;

    // Header with Hamburger Menu
    const headerHtml = `
            <header class="app-header">
                <a href="${this.resolvePath("index.html")}" class="app-logo">南陵祭'26</a>
                <div class="header-actions" style="display: flex; align-items: center;">
                    <div id="header-order-status-container" class="me-2"></div>
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
                <a href="${this.resolvePath("index.html")}" class="nav-item" data-page="home" data-track="click_nav_home">
                    <i class="bi bi-house-door-fill"></i>
                    <span class="nav-label">ホーム</span>
                </a>
                <a href="${this.resolvePath("projects-list.html")}" class="nav-item" data-page="projects" data-track="click_nav_projects">
                    <i class="bi bi-grid-fill"></i>
                    <span class="nav-label">企画</span>
                </a>
                
                <a href="${this.resolvePath("map.html")}" class="nav-item core-button" data-page="map" data-track="click_nav_map">
                    <div class="icon-circle" style="position: relative;">
                        <i class="bi bi-map-fill" style="font-size: 1.5rem;"></i>
                    </div>
                    <span class="nav-label" style="font-weight: 900; color: var(--primary-color)">マップ</span>
                </a>

                <a href="${this.resolvePath("stage-list.html")}" class="nav-item" data-page="stage" data-track="click_nav_stage">
                    <i class="bi bi-mic-fill"></i>
                    <span class="nav-label">ステージ</span>
                </a>
                
                <!-- Account / My Page Item -->
                <a href="${this.resolvePath("account.html")}" class="nav-item" data-page="account" data-track="click_nav_account">
                    <div id="nav-user-icon-container" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                         <i id="nav-icon-guest" class="bi bi-person-circle" style="font-size: 1.5rem;"></i>
                    </div>
                    <span class="nav-label">アカウント</span>
                </a>
            </nav>
        `;
    document.body.insertAdjacentHTML("beforeend", navHtml);

    // Smart Navigation for Account Tab
    const accountBtn = document.querySelector('.nav-item[data-page="account"]');
    if (accountBtn) {
      accountBtn.addEventListener("click", (e) => {
        const user = getCurrentUser();
        if (!user) {
          // 未ログイン時は二重リダイレクトを回避し直接ログイン画面へ遷移（ガクつき防止）
          e.preventDefault();
          const targetUrl = this.resolvePath("login.html?redirect=./account.html&reason=account");
          window.location.href = targetUrl;
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
    const voteUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfp5h3ff_OnUV_0zNVLEA7Efbd9Qyy5VYJWBJmWIWnTeZwnmQ/viewform?usp=header";

    const footerHtml = `
      <footer class="app-footer" id="app-footer">

        <!-- サイトマップ（4カラム） -->
        <nav class="footer-sitemap">

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">イベント</div>
            <ul class="footer-sitemap-list">
              <li><a href="${this.resolvePath("about.html")}" data-track="click_footer_link" data-track-target="about">概要</a></li>
              <li><a href="${this.resolvePath("access.html")}" data-track="click_footer_link" data-track-target="access">アクセス</a></li>
              <li><a href="${this.resolvePath("projects-list.html")}" data-track="click_footer_link" data-track-target="projects">企画一覧</a></li>
              <li><a href="${this.resolvePath("stage-list.html")}" data-track="click_footer_link" data-track-target="stage">ステージ発表</a></li>
              ${(typeof window.IS_MAP_ENABLED === "undefined" || window.IS_MAP_ENABLED !== false)
                ? `<li><a href="${this.resolvePath("map.html")}" data-track="click_footer_link" data-track-target="map">校内マップ</a></li>`
                : `<li><a href="javascript:void(0)" onclick="AppShell.showToast('校内マップは現在準備中です');" style="opacity: 0.65;" data-track="click_footer_link" data-track-target="map">校内マップ <span style="font-size:0.7rem;background:#fef3c7;color:#d97706;padding:1px 6px;border-radius:4px;">準備中</span></a></li>`
              }
            </ul>
          </div>

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">サービス</div>
            <ul class="footer-sitemap-list">
              <li><a href="${this.resolvePath("account.html")}" data-track="click_footer_link" data-track-target="account">アカウント設定</a></li>
            </ul>
          </div>

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">サポート</div>
            <ul class="footer-sitemap-list">
              <li>
                <a href="${csForm}" target="_blank" rel="noopener" data-track="click_footer_link" data-track-target="contact">
                  お問い合わせ<i class="bi bi-box-arrow-up-right ext-icon"></i>
                </a>
              </li>
              <li>
                <a href="${bugForm}" target="_blank" rel="noopener" data-track="click_footer_link" data-track-target="bug_report">
                  不具合報告<i class="bi bi-box-arrow-up-right ext-icon"></i>
                </a>
              </li>
              <li><a href="${this.resolvePath("terms.html")}" data-track="click_footer_link" data-track-target="terms">利用規約</a></li>
              <li><a href="${this.resolvePath("privacy.html")}" data-track="click_footer_link" data-track-target="privacy">プライバシーポリシー</a></li>
            </ul>
          </div>

          <div class="footer-sitemap-col">
            <div class="footer-sitemap-heading">コンピュータ科学部</div>
            <ul class="footer-sitemap-list">
              <li><a href="${this.resolvePath("about-us.html")}" data-track="click_footer_link" data-track-target="about_cs">コンピュータ科学部について</a></li>
            </ul>
            <div class="footer-sns-row">
              <a href="https://github.com/ynr-cs/nanryosai2026"
                 class="footer-sns-btn github"
                 target="_blank" rel="noopener" title="GitHub"
                 data-track="click_footer_sns" data-track-target="github">
                <i class="bi bi-github"></i>
              </a>
              <a href="https://www.instagram.com/ynr_cs"
                 class="footer-sns-btn instagram"
                 target="_blank" rel="noopener" title="Instagram"
                 data-track="click_footer_sns" data-track-target="instagram">
                <i class="bi bi-instagram"></i>
              </a>
            </div>
          </div>

        </nav>

        <!-- フッター内アンケートカード -->
        <div class="footer-survey-row">
          <a class="footer-survey-card" href="${surveyForm}" target="_blank" rel="noopener" data-track="click_footer_survey" data-track-target="cs_survey">
            <div class="footer-survey-icon"><i class="bi bi-ui-checks"></i></div>
            <div class="footer-survey-body">
              <span class="footer-survey-label">コンピュータ科学部 アンケート</span>
              <span class="footer-survey-title">サイトへのご意見・感想</span>
            </div>
            <i class="bi bi-chevron-right footer-survey-arrow"></i>
          </a>
          <a class="footer-survey-card" href="${voteUrl}" target="_blank" rel="noopener" data-track="click_footer_survey" data-track-target="vote">
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
    const surveyForm = "https://docs.google.com/forms/d/e/1FAIpQLSeCqNNdr9NFcosejNj0acvD7MSqFfmgOQIAVad_Ss1YV-Sh9A/viewform?usp=header";
    const voteUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfp5h3ff_OnUV_0zNVLEA7Efbd9Qyy5VYJWBJmWIWnTeZwnmQ/viewform?usp=header";

    const menuHtml = `
            <div class="app-menu-overlay" id="app-menu-overlay">
                <div class="app-menu-content">
                    <div class="menu-header">
                        <span>MENU</span>
                        <div onclick="document.getElementById('app-menu-overlay').classList.remove('active')" style="cursor:pointer; padding: 10px;" aria-label="閉じる">✕</div>
                    </div>

                    <div class="menu-body">
                        <!-- Main Navigation List (Borderless Clean Look) -->
                        <ul class="menu-list">
                            <li><a href="${this.resolvePath("about.html")}" data-track="click_menu_link" data-track-target="about">
                                <span style="font-size: 1.15rem; margin-right: 10px;">ℹ️</span> 開催概要
                            </a></li>
                            <li><a href="${this.resolvePath("projects-list.html")}" data-track="click_menu_link" data-track-target="projects">
                                <span style="font-size: 1.15rem; margin-right: 10px;">🎪</span> 企画一覧
                            </a></li>
                            <li><a href="${this.resolvePath("stage-list.html")}" data-track="click_menu_link" data-track-target="stage">
                                <span style="font-size: 1.15rem; margin-right: 10px;">🎤</span> ステージ発表
                            </a></li>
                            ${(typeof window.IS_MAP_ENABLED === "undefined" || window.IS_MAP_ENABLED !== false)
                              ? `<li><a href="${this.resolvePath("map.html")}" data-track="click_menu_link" data-track-target="map">
                                  <span style="font-size: 1.15rem; margin-right: 10px;">🗺️</span> 校内マップ
                                 </a></li>`
                              : `<li><a href="javascript:void(0)" onclick="AppShell.showToast('校内マップは現在準備中です');" data-track="click_menu_link" data-track-target="map" style="opacity: 0.75;">
                                  <span style="font-size: 1.15rem; margin-right: 10px;">🗺️</span> 校内マップ <span style="font-size:0.75rem;background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:6px;font-weight:700;margin-left:8px;">準備中</span>
                                 </a></li>`
                            }
                            <li><a href="${this.resolvePath("access.html")}" data-track="click_menu_link" data-track-target="access">
                                <span style="font-size: 1.15rem; margin-right: 10px;">🚃</span> アクセス
                            </a></li>
                        </ul>

                        <!-- Other Services (Accordion) -->
                        <div class="menu-accordion-section">
                            <button type="button" class="menu-accordion-toggle closed" id="menu-services-toggle" aria-expanded="false">
                                <span style="display: flex; align-items: center; gap: 8px;">
                                    <i class="bi bi-grid-3x3-gap-fill" style="color: var(--primary-color);"></i> その他のサービス
                                </span>
                                <i class="bi bi-chevron-down toggle-icon"></i>
                            </button>
                            <div class="menu-accordion-content" id="menu-services-content">
                                <div class="menu-quick-grid">
                                    <a href="${this.resolvePath("account.html")}" class="menu-quick-btn" data-track="click_menu_link" data-track-target="account">
                                        <i class="bi bi-person-circle"></i>
                                        <span>マイページ</span>
                                    </a>
                                    <a href="${voteUrl}" target="_blank" rel="noopener" class="menu-quick-btn ext-link" data-track="click_menu_link" data-track-target="vote">
                                        <i class="bi bi-trophy-fill" style="color:#f59e0b;"></i>
                                        <span>人気投票</span>
                                        <i class="bi bi-box-arrow-up-right ext-icon"></i>
                                    </a>
                                    <a href="${this.resolvePath("terms.html")}" class="menu-quick-btn" data-track="click_menu_link" data-track-target="terms">
                                        <i class="bi bi-file-text-fill" style="color:var(--primary-color);"></i>
                                        <span>利用規約</span>
                                    </a>
                                    <a href="${surveyForm}" target="_blank" rel="noopener" class="menu-quick-btn ext-link" data-track="click_menu_link" data-track-target="survey">
                                        <i class="bi bi-chat-heart-fill" style="color:#ec4899;"></i>
                                        <span>アンケート</span>
                                        <i class="bi bi-box-arrow-up-right ext-icon"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bottom Container (Isolated at bottom, directly above Powered By CS) -->
                    <div class="menu-bottom-container">
                        <!-- Theme Selector -->
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

                        <!-- Terms & Policy link row -->
                        <div class="menu-terms-row">
                            <a href="${this.resolvePath("terms.html")}" class="menu-terms-link" data-track="click_menu_link" data-track-target="terms">利用規約</a>
                            <span style="color: var(--border-color);">•</span>
                            <a href="${this.resolvePath("privacy.html")}" class="menu-terms-link" data-track="click_menu_link" data-track-target="privacy">プライバシー</a>
                        </div>

                        <!-- Footer -->
                        <div class="menu-footer">
                            <a href="${this.resolvePath("about-us.html")}" class="menu-footer-link" data-track="click_menu_link" data-track-target="about_cs">
                                Powered By コンピュータ科学部
                            </a>
                            <div id="app-version-display" style="font-size: 0.7rem; color: var(--text-sub); margin-top: 2px; opacity: 0.5; display: none;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", menuHtml);

    // Accordion Toggle Logic
    const servicesToggle = document.getElementById("menu-services-toggle");
    if (servicesToggle) {
      servicesToggle.addEventListener("click", () => {
        const isClosed = servicesToggle.classList.toggle("closed");
        servicesToggle.setAttribute("aria-expanded", !isClosed);
      });
    }

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
    if (show) {
      overlay.classList.add("active");
      this.updateVersionDisplay();
    } else {
      overlay.classList.remove("active");
    }
  },

  updateVersionDisplay: async function () {
    try {
      const versionEl = document.getElementById("app-version-display");
      if (!versionEl) return;

      const cachedVersion = sessionStorage.getItem("app_version");
      if (cachedVersion) {
        versionEl.textContent = `v${cachedVersion}`;
        versionEl.style.display = "block";
        return;
      }

      // Fetch lightweight version.json from root directory
      const response = await fetch(this.resolvePath("../version.json"));
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.version) {
        sessionStorage.setItem("app_version", data.version);
        versionEl.textContent = `v${data.version}`;
        versionEl.style.display = "block";
      }
    } catch (e) {
      console.warn("Failed to fetch version from version.json", e);
    }
  },

  highlightActiveTab: function () {
    let currentPage = window.CURRENT_PAGE;
    if (!currentPage) {
      const path = window.location.pathname;
      if (path.includes("index")) currentPage = "home";
      else if (path.includes("projects")) currentPage = "projects";
      else if (path.includes("map")) currentPage = "map";
      else if (path.includes("stage")) currentPage = "stage";
      else if (path.includes("account")) currentPage = "account";
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
    // Watch for auth changes
    watchUser((user) => {
      // User state watcher
    });
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

  showLoginPrompt: function (reason, redirectUrl, targetElement) {
    const existing = document.getElementById('login-prompt-popover');
    if (existing) existing.remove();

    const msg = reason === "favorite" ? "お気に入り機能を利用するにはログインが必要です。" : "この機能を利用するにはログインが必要です。";

    const popover = document.createElement("div");
    popover.id = "login-prompt-popover";
    Object.assign(popover.style, {
      position: "absolute",
      zIndex: "10000",
      background: "var(--card-bg, #ffffff)",
      border: "1px solid var(--border-color, #e9ecef)",
      borderRadius: "12px",
      padding: "16px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
      width: "240px",
      opacity: "0",
      transform: "translateY(10px)",
      transition: "opacity 0.2s ease, transform 0.2s ease"
    });

    popover.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
          <i class="bi bi-info-circle text-primary me-1"></i>ログイン
        </span>
        <button id="popover-close" style="background: none; border: none; padding: 0; color: var(--text-sub); font-size: 1.2rem; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-sub); margin-top: 0; margin-bottom: 12px; line-height: 1.4;">${msg}</p>
      <a href="${redirectUrl}" style="display: block; background: var(--primary-color, #2575fc); color: #fff; text-decoration: none; padding: 8px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 0.85rem;">
        ログイン画面へ
      </a>
    `;

    document.body.appendChild(popover);

    requestAnimationFrame(() => {
      let top = 0;
      let left = 0;
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        
        top = rect.top + scrollY - popover.offsetHeight - 10;
        left = rect.left + scrollX - (240 / 2) + (rect.width / 2);

        if (top < scrollY) {
           top = rect.bottom + scrollY + 10;
        }
        if (left < 10) left = 10;
        if (left + 240 > window.innerWidth - 10) left = window.innerWidth - 250;
      } else {
        // フォールバック: 中央配置
        top = (window.innerHeight / 2) - (popover.offsetHeight / 2) + (window.scrollY || window.pageYOffset);
        left = (window.innerWidth / 2) - 120;
      }

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;

      requestAnimationFrame(() => {
        popover.style.opacity = "1";
        popover.style.transform = "translateY(0)";
      });
    });

    const closeBtn = popover.querySelector("#popover-close");
    closeBtn.addEventListener("click", () => {
      popover.style.opacity = "0";
      popover.style.transform = "translateY(10px)";
      setTimeout(() => popover.remove(), 200);
    });

    setTimeout(() => {
      const clickOutside = (e) => {
        if (!popover.contains(e.target) && (!targetElement || !targetElement.contains(e.target))) {
          popover.style.opacity = "0";
          popover.style.transform = "translateY(10px)";
          setTimeout(() => popover.remove(), 200);
          document.removeEventListener("click", clickOutside);
        }
      };
      document.addEventListener("click", clickOutside);
    }, 0);
  },

  showToast: function (message, duration = 3000) {
    let toast = document.getElementById("app-global-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-global-toast";
      toast.style.cssText = `
        position: fixed;
        bottom: calc(var(--bottom-nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 24px);
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(15, 23, 42, 0.92);
        color: #fff;
        padding: 10px 20px;
        border-radius: 50px;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        backdrop-filter: blur(8px);
      `;
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="bi bi-info-circle-fill" style="color: #3b82f6;"></i> <span>${message}</span>`;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, duration);
  }
};

// Ensure init runs even if module is loaded after DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AppShell.init());
} else {
  AppShell.init();
}

// Expose AppShell to global scope for inline scripts
window.AppShell = AppShell;

