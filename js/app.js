/**
 * Color Studio Web Application
 * Minimalist color scheme generator controller with inline contextual feedback.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- App State ---
  const state = {
    primaryHex: "#6366F1",
    harmonyMode: "analogous",
    colors: [
      { hex: "#6366F1", locked: false },
      { hex: "#4F46E5", locked: false },
      { hex: "#818CF8", locked: false },
      { hex: "#06B6D4", locked: false },
      { hex: "#F43F5E", locked: false },
    ],
    themeMode: "system", // system, light, dark
    activeTab: "sandbox", // sandbox, tonal, contrast, export, presets
    activeExportFormat: "css", // css, tw4, tw3, flutter, compose, swift, tokens, svg
    visionFilter: "normal", // normal, protanopia, deuteranopia, tritanopia, achromatopsia
    sandboxDevice: "desktop", // desktop, mobile
    sandboxTheme: "auto", // auto, light, dark
  };

  // --- DOM Elements ---
  const seedColorInput = document.getElementById("seedColorInput");
  const seedHexInput = document.getElementById("seedHexInput");
  const seedSwatchWrap = document.getElementById("seedSwatchWrap");
  const harmonySelector = document.getElementById("harmonySelector");
  const paletteSwatches = document.getElementById("paletteSwatches");
  const tonalRampContainer = document.getElementById("tonalRampContainer");
  const deviceMorphFrame = document.getElementById("deviceMorphFrame");
  const deviceScreenViewport = document.getElementById("deviceScreenViewport");
  const exportCodeView = document.getElementById("exportCodeView");
  const exportFormatTitle = document.getElementById("exportFormatTitle");
  const imageUploadModal = document.getElementById("imageUploadModal");
  const imageDropZone = document.getElementById("imageDropZone");
  const imageFileInput = document.getElementById("imageFileInput");
  const visionSelect = document.getElementById("visionSelect");
  const presetsGrid = document.getElementById("presetsGrid");

  // --- Initial URL State Parsing ---
  function loadStateFromUrl() {
    try {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      const params = new URLSearchParams(hash);
      if (params.has("colors")) {
        const hexList = params.get("colors").split(",");
        if (hexList.length >= 2) {
          state.colors = hexList.map((hex, i) => ({
            hex: hex.startsWith("#") ? hex : `#${hex}`,
            locked: i === 0,
          }));
          state.primaryHex = state.colors[0].hex;
        }
      } else if (params.has("seed")) {
        const seed = params.get("seed");
        state.primaryHex = seed.startsWith("#") ? seed : `#${seed}`;
        if (params.has("mode")) {
          state.harmonyMode = params.get("mode");
        }
      }
    } catch (e) {
      console.warn("Could not load palette from URL hash", e);
    }
  }

  function updateUrlHash() {
    const colorHexes = state.colors
      .map((c) => c.hex.replace("#", ""))
      .join(",");
    const hash = `colors=${colorHexes}&mode=${state.harmonyMode}`;
    window.history.replaceState(null, "", `#${hash}`);
  }

  // --- Palette Generation ---
  function updatePalette(regenerate = true) {
    if (regenerate) {
      const generated = ColorUtils.generateHarmonies(
        state.primaryHex,
        state.harmonyMode,
        state.colors.length,
      );
      state.colors = state.colors.map((c, idx) => {
        if (c.locked) return c;
        return { hex: generated[idx] || state.primaryHex, locked: false };
      });
      if (!state.colors[0].locked) {
        state.colors[0].hex = state.primaryHex;
      }
    }

    // Sync input controls
    if (seedColorInput) seedColorInput.value = state.primaryHex;
    if (seedHexInput) seedHexInput.value = state.primaryHex.replace("#", "");
    if (seedSwatchWrap) seedSwatchWrap.style.backgroundColor = state.primaryHex;

    // Set document accent properties
    document.documentElement.style.setProperty(
      "--live-accent",
      state.primaryHex,
    );
    document.documentElement.style.setProperty(
      "--color-accent",
      `light-dark(${state.primaryHex}, ${state.primaryHex})`,
    );
    document.documentElement.style.setProperty(
      "--color-primary",
      state.primaryHex,
    );

    // Render modules
    renderSwatches();
    renderTonalScale();
    renderSandbox();
    renderContrastMatrix();
    renderExportCode();
    updateUrlHash();
  }

  // --- Render Palette Swatches with Inline Feedback (Inside Right Panel) ---
  function renderSwatches() {
    if (!paletteSwatches) return;
    paletteSwatches.innerHTML = "";

    state.colors.forEach((col, idx) => {
      const filteredHex = ColorUtils.simulateColorblindness(
        col.hex,
        state.visionFilter,
      );
      const oklch = ColorUtils.hexToOklch(col.hex) || [0.5, 0.1, 0];
      const textColor = ColorUtils.getReadableTextColor(filteredHex);

      const card = document.createElement("div");
      card.className = "swatch-item";

      card.innerHTML = `
        <div class="swatch-color-box" style="background-color: ${filteredHex}; color: ${textColor};" data-index="${idx}" title="Click to copy HEX">
          <span class="swatch-feedback-badge" id="feedback-${idx}">Copied</span>
        </div>
        <div class="swatch-meta-text">
          <div class="swatch-hex-val">
            <span id="hex-text-${idx}">${col.hex}</span>
          </div>
          <div class="swatch-oklch-val">L ${oklch[0].toFixed(2)} &bull; C ${oklch[1].toFixed(2)} &bull; ${Math.round(oklch[2])}°</div>
        </div>
        <div class="swatch-actions">
          <button class="swatch-mini-btn ${col.locked ? "active-lock" : ""}" data-action="toggle-lock" data-index="${idx}" title="${col.locked ? "Unlock Color" : "Lock Color"}">
            <span class="material-symbols-outlined" style="font-size: 0.95rem;">${col.locked ? "lock" : "lock_open"}</span>
          </button>
          <button class="swatch-mini-btn ${state.primaryHex === col.hex ? "active-primary" : ""}" data-action="set-primary" data-index="${idx}" title="Make Primary Seed">
            <span class="material-symbols-outlined" style="font-size: 0.95rem;">${state.primaryHex === col.hex ? "stars" : "star"}</span>
          </button>
          <button class="swatch-mini-btn" data-action="copy-hex" data-hex="${col.hex}" data-index="${idx}" title="Copy Hex">
            <span class="material-symbols-outlined" style="font-size: 0.95rem;">content_copy</span>
          </button>
        </div>
      `;

      paletteSwatches.appendChild(card);
    });

    // Swatch action events
    paletteSwatches
      .querySelectorAll("[data-action='toggle-lock']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index, 10);
          state.colors[index].locked = !state.colors[index].locked;
          renderSwatches();
        });
      });

    paletteSwatches
      .querySelectorAll("[data-action='set-primary']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = parseInt(btn.dataset.index, 10);
          state.primaryHex = state.colors[index].hex;
          updatePalette(true);
        });
      });

    paletteSwatches
      .querySelectorAll("[data-action='copy-hex']")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const hex = btn.dataset.hex;
          copyToClipboard(hex);
          const iconSpan = btn.querySelector(".material-symbols-outlined");
          if (iconSpan) iconSpan.textContent = "check";
          setTimeout(() => {
            if (iconSpan) iconSpan.textContent = "content_copy";
          }, 1200);
        });
      });

    paletteSwatches.querySelectorAll(".swatch-color-box").forEach((preview) => {
      preview.addEventListener("click", (e) => {
        const index = parseInt(preview.dataset.index, 10);
        copyToClipboard(state.colors[index].hex);

        // Show inline feedback badge
        const badge = document.getElementById(`feedback-${index}`);
        if (badge) {
          badge.classList.add("show");
          setTimeout(() => {
            badge.classList.remove("show");
          }, 1200);
        }
      });
    });
  }

  // --- Render Tonal Scale Ramp with Inline Feedback ---
  function renderTonalScale() {
    if (!tonalRampContainer) return;
    const tones = ColorUtils.generateTonalScale(state.primaryHex);

    let html = `<div class="tonal-grid">`;

    tones.forEach((tone, idx) => {
      const filtered = ColorUtils.simulateColorblindness(
        tone.hex,
        state.visionFilter,
      );
      html += `
        <div class="tonal-cell" style="background-color: ${filtered}; color: ${tone.text};" data-hex="${tone.hex}" data-idx="${idx}" title="Step ${tone.step} (${tone.hex})">
          <span class="tonal-cell-step">${tone.step}</span>
          <span class="tonal-cell-hex" id="tonal-hex-${idx}">${tone.hex}</span>
        </div>
      `;
    });

    html += `</div>`;
    tonalRampContainer.innerHTML = html;

    tonalRampContainer.querySelectorAll(".tonal-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        copyToClipboard(cell.dataset.hex);
        const idx = cell.dataset.idx;
        const hexEl = document.getElementById(`tonal-hex-${idx}`);
        if (hexEl) {
          const original = hexEl.textContent;
          hexEl.textContent = "Copied!";
          setTimeout(() => {
            hexEl.textContent = original;
          }, 1200);
        }
      });
    });
  }

  // --- App Theme Detection Helper ---
  function getActiveAppTheme() {
    const dataTheme = document.documentElement.getAttribute("data-theme");
    if (dataTheme === "dark" || dataTheme === "light") return dataTheme;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  // --- Render Interactive UI Sandbox (Real Device Simulator) ---
  function renderSandbox(animate = false) {
    if (!deviceMorphFrame || !deviceScreenViewport) return;
    const effectiveTheme =
      state.sandboxTheme === "auto" ? getActiveAppTheme() : state.sandboxTheme;
    const tokens = ColorUtils.deriveFullSystemTokens(state.primaryHex);
    const tones = ColorUtils.generateTonalScale(state.primaryHex);
    const t = effectiveTheme === "dark" ? tokens.dark : tokens.light;
    const isDark = effectiveTheme === "dark";

    // Toggle frame class for smooth dimensions and corner radius morphing
    if (state.sandboxDevice === "mobile") {
      deviceMorphFrame.classList.remove("mode-desktop");
      deviceMorphFrame.classList.add("mode-mobile");
    } else {
      deviceMorphFrame.classList.remove("mode-mobile");
      deviceMorphFrame.classList.add("mode-desktop");
    }

    const contentHtml =
      state.sandboxDevice === "mobile"
        ? createMobileSandboxHtml(t, tones, isDark)
        : createDesktopSandboxHtml(t, tones, isDark);

    if (animate) {
      deviceScreenViewport.classList.add("is-animating");
      setTimeout(() => {
        deviceScreenViewport.innerHTML = contentHtml;
        deviceScreenViewport.classList.remove("is-animating");
      }, 140);
    } else {
      deviceScreenViewport.innerHTML = contentHtml;
    }
  }

  function createDesktopSandboxHtml(t, tones, isDark) {
    const tonesSlice = tones && tones.length ? tones : [];
    const barsHtml = tonesSlice
      .map(
        (step) => `
        <div class="chart-bar-col">
          <div class="chart-bar-fill" style="height: ${Math.round(
            (step.l || 0.5) * 125,
          )}px; background-color: ${step.hex};"></div>
          <span class="chart-bar-label" style="color: ${t.textSecondary};">${
            step.step
          }</span>
        </div>
      `,
      )
      .join("");

    const tokensTableRows = [
      {
        name: "color.primary.base",
        hex: t.primary,
        oklch: "oklch(0.58 0.18 ...)",
        role: "Main CTA & Active States",
      },
      {
        name: "color.primary.container",
        hex: t.primaryContainer,
        oklch: "oklch(0.92 0.04 ...)",
        role: "Badges & Tonal Surfaces",
      },
      {
        name: "color.surface.raised",
        hex: t.surface,
        oklch: "oklch(0.96 0.01 ...)",
        role: "Cards & Elevated Panels",
      },
      {
        name: "color.status.success",
        hex: t.success,
        oklch: "oklch(0.65 0.16 ...)",
        role: "WCAG AA Validation & Confirmations",
      },
    ]
      .map(
        (row) => `
      <tr style="border-bottom: 1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"};">
        <td style="padding: 9px 12px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; color: ${t.textPrimary};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${row.hex}; flex-shrink: 0; display: inline-block;"></span>
            <span>${row.name}</span>
          </div>
        </td>
        <td style="padding: 9px 12px; font-family: var(--font-mono); font-size: 0.72rem; color: ${t.textSecondary};">${row.hex}</td>
        <td style="padding: 9px 12px; font-size: 0.72rem; color: ${t.textSecondary};">${row.role}</td>
        <td style="padding: 9px 12px; text-align: right;">
          <span class="mockup-status-chip" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">Compiled</span>
        </td>
      </tr>
    `,
      )
      .join("");

    return `
      <div class="device-desktop-frame" style="background-color: ${t.surface}; color: ${t.textPrimary};">
        <!-- Desktop App Body (Sidebar + Content) -->
        <div class="desktop-app-body">
          <!-- Mini App Sidebar -->
          <aside class="desktop-app-sidebar" style="background-color: ${t.surface};">
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
              <!-- Sidebar App Header -->
              <div style="display: flex; align-items: center; gap: 8px; padding: 4px 6px;">
                <div style="width: 24px; height: 24px; border-radius: 6px; background-color: ${t.primary}; color: ${t.onPrimary}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">C</div>
                <div>
                  <span style="font-size: 0.8rem; font-weight: 700; color: ${t.textPrimary}; display: block; line-height: 1.1;">ColorStudio</span>
                  <span style="font-size: 0.65rem; color: ${t.textSecondary};">Design System</span>
                </div>
              </div>

              <!-- Nav List -->
              <div class="desktop-nav-list">
                <div class="desktop-nav-item active" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">dashboard</span>
                  <span>Overview</span>
                </div>
                <div class="desktop-nav-item" style="color: ${t.textSecondary};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">palette</span>
                  <span>Tokens</span>
                </div>
                <div class="desktop-nav-item" style="color: ${t.textSecondary};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">layers</span>
                  <span>Components</span>
                </div>
                <div class="desktop-nav-item" style="color: ${t.textSecondary};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">analytics</span>
                  <span>Analytics</span>
                </div>
                <div class="desktop-nav-item" style="color: ${t.textSecondary};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">group</span>
                  <span>Team</span>
                </div>
                <div class="desktop-nav-item" style="color: ${t.textSecondary};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">tune</span>
                  <span>Settings</span>
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Plan / Usage Widget -->
              <div class="desktop-sidebar-card" style="background-color: ${t.background}; color: ${t.textSecondary};">
                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; margin-bottom: 6px;">
                  <span>Tokens Capacity</span>
                  <span style="font-weight: 600; color: ${t.textPrimary};">84%</span>
                </div>
                <div class="progress-bar-track" style="background-color: ${t.surface};">
                  <div class="progress-bar-fill" style="width: 84%; background-color: ${t.primary};"></div>
                </div>
              </div>

              <!-- Profile Pill -->
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background-color: ${t.background};">
                <div style="width: 22px; height: 22px; border-radius: 50%; background-color: ${t.primary}; color: ${t.onPrimary}; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700;">JD</div>
                <div style="flex: 1; min-width: 0;">
                  <span style="font-size: 0.725rem; font-weight: 600; color: ${t.textPrimary}; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Acme Core</span>
                  <span style="font-size: 0.625rem; color: ${t.textSecondary};">Pro Workspace</span>
                </div>
              </div>
            </div>
          </aside>

          <!-- Main Content Canvas -->
          <main class="desktop-app-canvas" style="background-color: ${t.background};">
            <!-- Canvas Header -->
            <div class="desktop-canvas-header">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: ${t.textPrimary}; margin: 0;">Performance Overview</h3>
                <p style="font-size: 0.775rem; color: ${t.textSecondary}; margin: 3px 0 0;">Native OKLCH real-time design tokens simulation &amp; system health</p>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button class="mockup-btn" style="background-color: ${t.surface}; color: ${t.textPrimary};">
                  <span class="material-symbols-outlined" style="font-size: 0.95rem">download</span>
                  <span>Export</span>
                </button>
                <button class="mockup-btn" style="background-color: ${t.primary}; color: ${t.onPrimary};">
                  <span class="material-symbols-outlined" style="font-size: 0.95rem">add</span>
                  <span>New Metric</span>
                </button>
              </div>
            </div>

            <!-- KPI Metric Cards Grid -->
            <div class="desktop-kpi-grid">
              <div class="desktop-kpi-card" style="background-color: ${t.surface};">
                <span style="font-size: 0.725rem; color: ${t.textSecondary}; font-weight: 500;">Annual Recurring Revenue</span>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;">
                  <span style="font-size: 1.4rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">$148,200</span>
                  <span class="mockup-badge" style="background-color: ${t.success}22; color: ${t.success};">+18.4%</span>
                </div>
              </div>

              <div class="desktop-kpi-card" style="background-color: ${t.surface};">
                <span style="font-size: 0.725rem; color: ${t.textSecondary}; font-weight: 500;">Active Design Tokens</span>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;">
                  <span style="font-size: 1.4rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">64 Tokens</span>
                  <span class="mockup-badge" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">Live</span>
                </div>
              </div>

              <div class="desktop-kpi-card" style="background-color: ${t.surface};">
                <span style="font-size: 0.725rem; color: ${t.textSecondary}; font-weight: 500;">Accessibility Rating</span>
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;">
                  <span style="font-size: 1.4rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">100% WCAG</span>
                  <span class="mockup-badge" style="background-color: ${t.success}22; color: ${t.success};">AAA</span>
                </div>
              </div>
            </div>

            <!-- Charts & Activity Grid -->
            <div class="desktop-charts-grid">
              <div class="desktop-chart-card" style="background-color: ${t.surface};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: ${t.textPrimary};">Token Lightness Ramp Distribution</span>
                  <span style="font-size: 0.7rem; color: ${t.textSecondary}; font-family: var(--font-mono);">OKLCH</span>
                </div>
                <div class="desktop-bar-chart">
                  ${barsHtml}
                </div>
              </div>

              <div class="desktop-activity-card" style="background-color: ${t.surface};">
                <span style="font-size: 0.85rem; font-weight: 600; color: ${t.textPrimary}; margin-bottom: 12px; display: block;">System Activity</span>
                <div class="activity-list">
                  <div class="activity-row">
                    <div class="activity-indicator" style="background-color: ${t.primary};"></div>
                    <div class="activity-details">
                      <span style="font-size: 0.775rem; font-weight: 600; color: ${t.textPrimary};">Primary Accent Synced</span>
                      <span style="font-size: 0.7rem; color: ${t.textSecondary};">Seed ${state.primaryHex} &bull; Just now</span>
                    </div>
                    <span class="mockup-status-chip" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">Active</span>
                  </div>

                  <div class="activity-row">
                    <div class="activity-indicator" style="background-color: ${t.success};"></div>
                    <div class="activity-details">
                      <span style="font-size: 0.775rem; font-weight: 600; color: ${t.textPrimary};">WCAG AA Contrast Validated</span>
                      <span style="font-size: 0.7rem; color: ${t.textSecondary};">4.5:1 ratio threshold pass</span>
                    </div>
                    <span class="mockup-status-chip" style="background-color: ${t.success}22; color: ${t.success};">Passed</span>
                  </div>

                  <div class="activity-row">
                    <div class="activity-indicator" style="background-color: ${t.warning};"></div>
                    <div class="activity-details">
                      <span style="font-size: 0.775rem; font-weight: 600; color: ${t.textPrimary};">Design Tokens Export Ready</span>
                      <span style="font-size: 0.7rem; color: ${t.textSecondary};">8 platform formats compiled</span>
                    </div>
                    <span class="mockup-status-chip" style="background-color: ${t.warning}22; color: ${t.warning};">Ready</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom System Tokens Catalog Table -->
            <div class="desktop-tokens-table-card" style="background-color: ${t.surface}; padding: 16px; border-radius: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 0.85rem; font-weight: 600; color: ${t.textPrimary};">Active Design Tokens Manifest</span>
                <span style="font-size: 0.7rem; color: ${t.textSecondary};">Live Perceptual Hierarchy</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="border-bottom: 1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};">
                    <th style="padding: 6px 12px; font-size: 0.68rem; font-weight: 600; color: ${t.textSecondary};">TOKEN NAME</th>
                    <th style="padding: 6px 12px; font-size: 0.68rem; font-weight: 600; color: ${t.textSecondary};">HEX VALUE</th>
                    <th style="padding: 6px 12px; font-size: 0.68rem; font-weight: 600; color: ${t.textSecondary};">SEMANTIC ROLE</th>
                    <th style="padding: 6px 12px; font-size: 0.68rem; font-weight: 600; color: ${t.textSecondary}; text-align: right;">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  ${tokensTableRows}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    `;
  }

  function createMobileSandboxHtml(t, tones, isDark) {
    const gradientEnd = tones && tones[7] ? tones[7].hex : t.primary;

    return `
      <div class="device-mobile-frame" style="background-color: ${t.surface}; color: ${t.textPrimary};">
        <!-- In-App Viewport -->
        <div class="mobile-viewport" style="background-color: ${t.background};">
          <!-- In-App Header -->
          <div class="mobile-app-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="mobile-avatar" style="background-color: ${t.primary}; color: ${t.onPrimary};">A</div>
              <div>
                <span style="font-size: 0.7rem; color: ${t.textSecondary}; display: block;">Welcome back</span>
                <span style="font-size: 0.9rem; font-weight: 700; color: ${t.textPrimary};">Alex Rivera</span>
              </div>
            </div>
            <div class="mobile-icon-badge" style="background-color: ${t.surface}; color: ${t.textPrimary};">
              <span class="material-symbols-outlined" style="font-size: 1.15rem">notifications</span>
              <span class="notification-dot" style="background-color: ${t.primary};"></span>
            </div>
          </div>

          <!-- Hero Balance Card -->
          <div class="mobile-hero-card" style="background: linear-gradient(135deg, ${t.primary}, ${gradientEnd}); color: ${t.onPrimary};">
            <div style="display: flex; justify-content: space-between; align-items: center; opacity: 0.9;">
              <span style="font-size: 0.75rem; font-weight: 500;">Total Balance</span>
              <span class="material-symbols-outlined" style="font-size: 1.15rem">contactless</span>
            </div>
            <div style="font-size: 1.95rem; font-weight: 800; font-family: var(--font-mono); margin: 8px 0;">$24,850.00</div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; opacity: 0.95;">
              <span>•••• 4829</span>
              <span>09/28</span>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="mobile-actions-grid">
            <div class="mobile-action-pill" style="background-color: ${t.surface}; color: ${t.textPrimary};">
              <div class="mobile-action-icon" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">
                <span class="material-symbols-outlined" style="font-size: 1.15rem">send</span>
              </div>
              <span style="font-size: 0.7rem; font-weight: 600;">Send</span>
            </div>
            <div class="mobile-action-pill" style="background-color: ${t.surface}; color: ${t.textPrimary};">
              <div class="mobile-action-icon" style="background-color: ${t.background}; color: ${t.textPrimary};">
                <span class="material-symbols-outlined" style="font-size: 1.15rem">call_received</span>
              </div>
              <span style="font-size: 0.7rem; font-weight: 600;">Receive</span>
            </div>
            <div class="mobile-action-pill" style="background-color: ${t.surface}; color: ${t.textPrimary};">
              <div class="mobile-action-icon" style="background-color: ${t.background}; color: ${t.textPrimary};">
                <span class="material-symbols-outlined" style="font-size: 1.15rem">swap_horiz</span>
              </div>
              <span style="font-size: 0.7rem; font-weight: 600;">Swap</span>
            </div>
            <div class="mobile-action-pill" style="background-color: ${t.surface}; color: ${t.textPrimary};">
              <div class="mobile-action-icon" style="background-color: ${t.background}; color: ${t.textPrimary};">
                <span class="material-symbols-outlined" style="font-size: 1.15rem">add</span>
              </div>
              <span style="font-size: 0.7rem; font-weight: 600;">Top Up</span>
            </div>
          </div>

          <!-- Transactions Stream -->
          <div class="mobile-feed-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 0.825rem; font-weight: 700; color: ${t.textPrimary};">Recent Activity</span>
              <span style="font-size: 0.725rem; color: ${t.primary}; font-weight: 600; cursor: pointer;">View All</span>
            </div>

            <div class="mobile-tx-list">
              <div class="mobile-tx-row" style="background-color: ${t.surface};">
                <div class="mobile-tx-icon" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">shopping_bag</span>
                </div>
                <div class="mobile-tx-info">
                  <span style="font-size: 0.75rem; font-weight: 600; color: ${t.textPrimary};">Apple Store</span>
                  <span style="font-size: 0.68rem; color: ${t.textSecondary};">Design Tool &bull; Today</span>
                </div>
                <span style="font-size: 0.8rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">-$129.00</span>
              </div>

              <div class="mobile-tx-row" style="background-color: ${t.surface};">
                <div class="mobile-tx-icon" style="background-color: ${t.success}22; color: ${t.success};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">payments</span>
                </div>
                <div class="mobile-tx-info">
                  <span style="font-size: 0.75rem; font-weight: 600; color: ${t.textPrimary};">Client Payment</span>
                  <span style="font-size: 0.68rem; color: ${t.textSecondary};">Transfer &bull; Yesterday</span>
                </div>
                <span style="font-size: 0.8rem; font-weight: 700; color: ${t.success}; font-family: var(--font-mono);">+$4,500.00</span>
              </div>

              <div class="mobile-tx-row" style="background-color: ${t.surface};">
                <div class="mobile-tx-icon" style="background-color: ${t.background}; color: ${t.textSecondary};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">local_cafe</span>
                </div>
                <div class="mobile-tx-info">
                  <span style="font-size: 0.75rem; font-weight: 600; color: ${t.textPrimary};">Starbucks</span>
                  <span style="font-size: 0.68rem; color: ${t.textSecondary};">Food &bull; 2 days ago</span>
                </div>
                <span style="font-size: 0.8rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">-$6.50</span>
              </div>

              <div class="mobile-tx-row" style="background-color: ${t.surface};">
                <div class="mobile-tx-icon" style="background-color: ${t.primaryContainer}; color: ${t.onPrimaryContainer};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">subscriptions</span>
                </div>
                <div class="mobile-tx-info">
                  <span style="font-size: 0.75rem; font-weight: 600; color: ${t.textPrimary};">Figma Organization</span>
                  <span style="font-size: 0.68rem; color: ${t.textSecondary};">Subscription &bull; 4 days ago</span>
                </div>
                <span style="font-size: 0.8rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">-$45.00</span>
              </div>

              <div class="mobile-tx-row" style="background-color: ${t.surface};">
                <div class="mobile-tx-icon" style="background-color: ${t.warning}22; color: ${t.warning};">
                  <span class="material-symbols-outlined" style="font-size: 1.05rem">flight</span>
                </div>
                <div class="mobile-tx-info">
                  <span style="font-size: 0.75rem; font-weight: 600; color: ${t.textPrimary};">Delta Airlines</span>
                  <span style="font-size: 0.68rem; color: ${t.textSecondary};">Travel &bull; 5 days ago</span>
                </div>
                <span style="font-size: 0.8rem; font-weight: 700; color: ${t.textPrimary}; font-family: var(--font-mono);">-$380.00</span>
              </div>
            </div>
          </div>

          <!-- Bottom Tab Bar -->
          <div class="mobile-tab-bar" style="background-color: ${t.surface};">
            <div class="mobile-tab-item active" style="color: ${t.primary};">
              <span class="material-symbols-outlined" style="font-size: 1.25rem">home</span>
              <span style="font-size: 0.65rem; font-weight: 600;">Home</span>
            </div>
            <div class="mobile-tab-item" style="color: ${t.textSecondary};">
              <span class="material-symbols-outlined" style="font-size: 1.25rem">bar_chart</span>
              <span style="font-size: 0.65rem;">Stats</span>
            </div>
            <div class="mobile-tab-item" style="color: ${t.textSecondary};">
              <span class="material-symbols-outlined" style="font-size: 1.25rem">credit_card</span>
              <span style="font-size: 0.65rem;">Cards</span>
            </div>
            <div class="mobile-tab-item" style="color: ${t.textSecondary};">
              <span class="material-symbols-outlined" style="font-size: 1.25rem">person</span>
              <span style="font-size: 0.65rem;">Profile</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- Render Contrast & Accessibility Matrix ---
  function renderContrastMatrix() {
    const container = document.getElementById("contrastMatrixContainer");
    if (!container) return;

    const tokens = ColorUtils.deriveFullSystemTokens(state.primaryHex);
    const testPairs = [
      {
        name: "Primary on Surface (Light)",
        fg: tokens.light.primary,
        bg: tokens.light.surface,
      },
      {
        name: "Text Primary on Light Surface",
        fg: tokens.light.textPrimary,
        bg: tokens.light.surface,
      },
      {
        name: "Text Secondary on Light Surface",
        fg: tokens.light.textSecondary,
        bg: tokens.light.surface,
      },
      {
        name: "On-Primary on Primary Button",
        fg: tokens.light.onPrimary,
        bg: tokens.light.primary,
      },
      {
        name: "Primary on Surface (Dark)",
        fg: tokens.dark.primary,
        bg: tokens.dark.surface,
      },
      {
        name: "Text Primary on Dark Surface",
        fg: tokens.dark.textPrimary,
        bg: tokens.dark.surface,
      },
      {
        name: "Success on Dark Surface",
        fg: tokens.dark.success,
        bg: tokens.dark.surface,
      },
      {
        name: "Danger on Light Surface",
        fg: tokens.light.danger,
        bg: tokens.light.surface,
      },
    ];

    let html = `
      <table class="clean-table">
        <thead>
          <tr>
            <th>Color Pair</th>
            <th>Sample</th>
            <th>Ratio</th>
            <th>WCAG AA</th>
            <th>WCAG AAA</th>
          </tr>
        </thead>
        <tbody>
    `;

    testPairs.forEach((pair) => {
      const ratio = ColorUtils.getContrastRatio(pair.fg, pair.bg);
      const rating = ColorUtils.getWcagRating(ratio);
      const isAa = rating.aaNormal;
      const isAaa = rating.aaaNormal;

      html += `
        <tr>
          <td style="font-weight: 500;">${pair.name}</td>
          <td>
            <div style="display: inline-flex; padding: 3px 10px; border-radius: 9999px; background-color: ${pair.bg};">
              <span style="color: ${pair.fg}; font-weight: 600; font-size: 0.75rem;">Aa Text</span>
            </div>
          </td>
          <td><span style="font-family: var(--font-mono); font-weight: 600;">${rating.ratio}:1</span></td>
          <td><span class="badge-pill ${isAa ? "badge-pass" : "badge-fail"}">${isAa ? "Pass" : "Fail"}</span></td>
          <td><span class="badge-pill ${isAaa ? "badge-pass" : "badge-fail"}">${isAaa ? "Pass" : "Fail"}</span></td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // --- Multi-Platform Code Exporter ---
  function renderExportCode() {
    if (!exportCodeView) return;
    const tokens = ColorUtils.deriveFullSystemTokens(state.primaryHex);
    const tones = ColorUtils.generateTonalScale(state.primaryHex);
    const colorList = state.colors.map((c) => c.hex);

    let code = "";
    let title = "";

    switch (state.activeExportFormat) {
      case "css":
        title = "CSS Custom Properties (:root)";
        code = `:root {
  color-scheme: light dark;

  /* Brand & Accent Tokens */
  --color-accent: ${state.primaryHex};
  --color-accent-solid: light-dark(${tokens.light.primary}, ${tokens.dark.primary});
  --color-accent-subtle: light-dark(${tokens.light.primaryContainer}, ${tokens.dark.primaryContainer});
  --color-secondary: light-dark(${tokens.light.secondary}, ${tokens.dark.secondary});

  /* Surfaces (Pure Tonal Elevation - Zero Borders & Shadows) */
  --color-bg-app: light-dark(${tokens.light.background}, ${tokens.dark.background});
  --color-bg-subtle: light-dark(${tokens.light.subtle}, ${tokens.dark.subtle});
  --color-bg-surface: light-dark(${tokens.light.surface}, ${tokens.dark.surface});
  --color-bg-raised: light-dark(${tokens.light.surfaceRaised}, ${tokens.dark.surfaceRaised});
  --color-bg-sunken: light-dark(${tokens.light.surfaceSunken}, ${tokens.dark.surfaceSunken});

  /* Typography Roles */
  --color-text-primary: light-dark(${tokens.light.textPrimary}, ${tokens.dark.textPrimary});
  --color-text-secondary: light-dark(${tokens.light.textSecondary}, ${tokens.dark.textSecondary});
  --color-text-muted: light-dark(${tokens.light.textMuted}, ${tokens.dark.textMuted});

  /* Status Roles */
  --color-success: light-dark(${tokens.light.success}, ${tokens.dark.success});
  --color-warning: light-dark(${tokens.light.warning}, ${tokens.dark.warning});
  --color-danger: light-dark(${tokens.light.danger}, ${tokens.dark.danger});
  --color-info: light-dark(${tokens.light.info}, ${tokens.dark.info});
}`;
        break;

      case "tw4":
        title = "Tailwind CSS v4 (@theme block)";
        code = `@theme {
  --color-primary: ${state.primaryHex};
  --color-primary-50: ${tones[0].hex};
  --color-primary-100: ${tones[1].hex};
  --color-primary-200: ${tones[2].hex};
  --color-primary-300: ${tones[3].hex};
  --color-primary-400: ${tones[4].hex};
  --color-primary-500: ${tones[5].hex};
  --color-primary-600: ${tones[6].hex};
  --color-primary-700: ${tones[7].hex};
  --color-primary-800: ${tones[8].hex};
  --color-primary-900: ${tones[9].hex};
  --color-primary-950: ${tones[10].hex};
}`;
        break;

      case "tw3":
        title = "Tailwind CSS v3 (tailwind.config.js)";
        code = `module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '${tones[0].hex}',
          100: '${tones[1].hex}',
          200: '${tones[2].hex}',
          300: '${tones[3].hex}',
          400: '${tones[4].hex}',
          500: '${tones[5].hex}',
          600: '${tones[6].hex}',
          700: '${tones[7].hex}',
          800: '${tones[8].hex}',
          900: '${tones[9].hex}',
          950: '${tones[10].hex}',
        }
      }
    }
  }
};`;
        break;

      case "flutter":
        title = "Flutter Material 3 (ColorScheme)";
        code = `import 'package:flutter/material.dart';

final lightColorScheme = ColorScheme.light(
  primary: const Color(0xFF${tokens.light.primary.replace("#", "")}),
  onPrimary: const Color(0xFF${tokens.light.onPrimary.replace("#", "")}),
  surface: const Color(0xFF${tokens.light.surface.replace("#", "")}),
  onSurface: const Color(0xFF${tokens.light.textPrimary.replace("#", "")}),
  outline: const Color(0xFF${tokens.light.border.replace("#", "")}),
);

final darkColorScheme = ColorScheme.dark(
  primary: const Color(0xFF${tokens.dark.primary.replace("#", "")}),
  onPrimary: const Color(0xFF${tokens.dark.onPrimary.replace("#", "")}),
  surface: const Color(0xFF${tokens.dark.surface.replace("#", "")}),
  onSurface: const Color(0xFF${tokens.dark.textPrimary.replace("#", "")}),
  outline: const Color(0xFF${tokens.dark.border.replace("#", "")}),
);`;
        break;

      case "compose":
        title = "Jetpack Compose (Material3 Theme)";
        code = `import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

val LightTheme = lightColorScheme(
    primary = Color(0xFF${tokens.light.primary.replace("#", "")}),
    surface = Color(0xFF${tokens.light.surface.replace("#", "")}),
    onSurface = Color(0xFF${tokens.light.textPrimary.replace("#", "")}),
)

val DarkTheme = darkColorScheme(
    primary = Color(0xFF${tokens.dark.primary.replace("#", "")}),
    surface = Color(0xFF${tokens.dark.surface.replace("#", "")}),
    onSurface = Color(0xFF${tokens.dark.textPrimary.replace("#", "")}),
)`;
        break;

      case "swift":
        title = "SwiftUI (Color Extension)";
        code = `import SwiftUI

extension Color {
    static let brandAccent = Color(hex: "${state.primaryHex}")
    static let appBackground = Color(hex: "${tokens.light.background}")
    static let appSurface = Color(hex: "${tokens.light.surface}")
    static let appText = Color(hex: "${tokens.light.textPrimary}")
}`;
        break;

      case "tokens":
        title = "Design Tokens (W3C JSON)";
        const tokenObj = {
          color: {
            primary: { value: state.primaryHex, type: "color" },
            palette: state.colors.map((c) => ({ value: c.hex, type: "color" })),
            scale: {},
          },
        };
        tones.forEach((t) => {
          tokenObj.color.scale[t.step] = { value: t.hex, type: "color" };
        });
        code = JSON.stringify(tokenObj, null, 2);
        break;

      case "svg":
        title = "SVG Palette Swatches";
        const swatchWidth = 80;
        const totalWidth = colorList.length * swatchWidth;
        const rects = colorList
          .map(
            (hex, i) =>
              `<rect x="${i * swatchWidth}" y="0" width="${swatchWidth}" height="100" fill="${hex}" />`,
          )
          .join("\n  ");
        code = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 100" width="${totalWidth}" height="100">
  ${rects}
</svg>`;
        break;
    }

    if (exportFormatTitle) exportFormatTitle.textContent = title;
    exportCodeView.value = code;
  }

  // --- Render Presets Gallery ---
  function renderPresets() {
    if (!presetsGrid) return;
    presetsGrid.innerHTML = "";

    ColorUtils.PRESETS.forEach((preset) => {
      const card = document.createElement("div");
      card.className = "surface-card preset-item";

      const swatchStrips = preset.colors
        .map(
          (c) =>
            `<div class="preset-strip-cell" style="background-color: ${c};"></div>`,
        )
        .join("");

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
          <div class="preset-strip">
            ${swatchStrips}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: var(--text-caption); font-weight: 600; color: var(--color-text-primary);">${preset.name}</span>
            <span style="font-size: var(--text-xs); color: var(--color-text-muted);">${preset.category}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        state.primaryHex = preset.primary;
        state.colors = preset.colors.map((c, i) => ({
          hex: c,
          locked: i === 0,
        }));
        updatePalette(false);
      });

      presetsGrid.appendChild(card);
    });
  }

  // --- Copy Helper ---
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {}
    textArea.remove();
  }

  function downloadExport() {
    const code = exportCodeView.value;
    let ext =
      state.activeExportFormat === "svg"
        ? "svg"
        : state.activeExportFormat === "tokens"
          ? "json"
          : "txt";
    let filename = `tokens.${ext}`;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- EyeDropper API ---
  async function openEyeDropper() {
    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          state.primaryHex = result.sRGBHex.toUpperCase();
          updatePalette(true);
        }
      } catch (e) {}
    }
  }

  // --- Image Extraction ---
  function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const colors = await ColorUtils.extractPaletteFromImageData(
            img,
            state.colors.length,
          );
          if (colors && colors.length > 0) {
            state.primaryHex = colors[0];
            state.colors = colors.map((c, i) => ({ hex: c, locked: i === 0 }));
            updatePalette(false);
            closeImageModal();
          }
        } catch (err) {}
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function openImageModal() {
    if (imageUploadModal) imageUploadModal.classList.add("open");
  }

  function closeImageModal() {
    if (imageUploadModal) imageUploadModal.classList.remove("open");
  }

  // --- Event Listeners with Inline Feedback ---
  function setupEventListeners() {
    if (seedColorInput) {
      seedColorInput.addEventListener("input", (e) => {
        state.primaryHex = e.target.value.toUpperCase();
        updatePalette(true);
      });
    }

    if (seedHexInput) {
      seedHexInput.addEventListener("input", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith("#")) val = `#${val}`;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          state.primaryHex = val.toUpperCase();
          updatePalette(true);
        }
      });
    }

    document.querySelectorAll("button[data-harmony]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("button[data-harmony]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.harmonyMode = btn.dataset.harmony;
        updatePalette(true);
      });
    });

    const randomizeBtn = document.getElementById("randomizeBtn");
    if (randomizeBtn) {
      randomizeBtn.addEventListener("click", () => {
        const randHue = Math.floor(Math.random() * 360);
        state.primaryHex = ColorUtils.oklchToHex(0.55, 0.16, randHue);
        updatePalette(true);
      });
    }

    const eyedropperBtn = document.getElementById("eyedropperBtn");
    if (eyedropperBtn) {
      if ("EyeDropper" in window) {
        eyedropperBtn.addEventListener("click", openEyeDropper);
      } else {
        eyedropperBtn.style.display = "none";
      }
    }

    const openImageBtn = document.getElementById("openImageBtn");
    if (openImageBtn) openImageBtn.addEventListener("click", openImageModal);

    const closeImageModalBtn = document.getElementById("closeImageModalBtn");
    if (closeImageModalBtn)
      closeImageModalBtn.addEventListener("click", closeImageModal);

    if (imageUploadModal) {
      imageUploadModal.addEventListener("click", (e) => {
        if (e.target === imageUploadModal) closeImageModal();
      });
    }

    if (imageDropZone && imageFileInput) {
      imageDropZone.addEventListener("click", () => imageFileInput.click());
      imageFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
      });

      imageDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        imageDropZone.classList.add("dragover");
      });

      imageDropZone.addEventListener("dragleave", () => {
        imageDropZone.classList.remove("dragover");
      });

      imageDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        imageDropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
          handleImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("[data-tab]")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".tab-panel")
          .forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        state.activeTab = btn.dataset.tab;
        const targetPane = document.getElementById(`tab-${btn.dataset.tab}`);
        if (targetPane) targetPane.classList.add("active");
      });
    });

    // Sandbox Device Switcher (Desktop vs Mobile)
    document
      .querySelectorAll("#sandboxDeviceGroup button[data-device]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (state.sandboxDevice === btn.dataset.device) return;
          document
            .querySelectorAll("#sandboxDeviceGroup button[data-device]")
            .forEach((b) => {
              b.classList.remove("active");
              b.setAttribute("aria-selected", "false");
            });
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
          state.sandboxDevice = btn.dataset.device;
          renderSandbox(true);
        });
      });

    // Sandbox Preview Theme Switcher (Auto, Light, Dark)
    document
      .querySelectorAll("#sandboxThemeGroup button[data-theme]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (state.sandboxTheme === btn.dataset.theme) return;
          document
            .querySelectorAll("#sandboxThemeGroup button[data-theme]")
            .forEach((b) => {
              b.classList.remove("active");
              b.setAttribute("aria-selected", "false");
            });
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
          state.sandboxTheme = btn.dataset.theme;
          renderSandbox(true);
        });
      });

    // Listen to OS theme changes to auto-update simulation
    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          if (state.sandboxTheme === "auto") {
            renderSandbox(false);
          }
        });
    }

    document
      .querySelectorAll(".exporter-format-bar button[data-format]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".exporter-format-bar button[data-format]")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.activeExportFormat = btn.dataset.format;
          renderExportCode();
        });
      });

    // Inline Feedback for Copy Export Button
    const copyExportBtn = document.getElementById("copyExportBtn");
    if (copyExportBtn) {
      copyExportBtn.addEventListener("click", () => {
        copyToClipboard(exportCodeView.value);
        const icon = copyExportBtn.querySelector(".material-symbols-outlined");
        const label = copyExportBtn.querySelector(
          "span:not(.material-symbols-outlined)",
        );
        if (icon) icon.textContent = "check";
        if (label) label.textContent = "Copied";
        setTimeout(() => {
          if (icon) icon.textContent = "content_copy";
          if (label) label.textContent = "Copy";
        }, 1400);
      });
    }

    // Inline Feedback for Download Export Button
    const downloadExportBtn = document.getElementById("downloadExportBtn");
    if (downloadExportBtn) {
      downloadExportBtn.addEventListener("click", () => {
        downloadExport();
        const icon = downloadExportBtn.querySelector(
          ".material-symbols-outlined",
        );
        const label = downloadExportBtn.querySelector(
          "span:not(.material-symbols-outlined)",
        );
        if (icon) icon.textContent = "check";
        if (label) label.textContent = "Downloaded";
        setTimeout(() => {
          if (icon) icon.textContent = "download";
          if (label) label.textContent = "Download";
        }, 1400);
      });
    }

    if (visionSelect) {
      visionSelect.addEventListener("change", (e) => {
        state.visionFilter = e.target.value;
        renderSwatches();
        renderTonalScale();
      });
    }

    // Inline Feedback for Share Button
    const sharePaletteBtn = document.getElementById("sharePaletteBtn");
    if (sharePaletteBtn) {
      sharePaletteBtn.addEventListener("click", () => {
        updateUrlHash();
        copyToClipboard(window.location.href);
        const icon = sharePaletteBtn.querySelector(
          ".material-symbols-outlined",
        );
        if (icon) {
          icon.textContent = "check";
          setTimeout(() => {
            icon.textContent = "share";
          }, 1400);
        }
      });
    }

    // Sidebar & Inspector Collapsible Offcanvas Controls
    const appShell = document.getElementById("appShell");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    const openSidebarBtn = document.getElementById("openSidebarBtn");
    const closeInspectorBtn = document.getElementById("closeInspectorBtn");
    const openInspectorBtn = document.getElementById("openInspectorBtn");

    function setSidebarCollapsed(collapsed) {
      if (!appShell) return;
      if (collapsed) {
        appShell.classList.add("sidebar-collapsed");
      } else {
        appShell.classList.remove("sidebar-collapsed");
      }
    }

    function setInspectorCollapsed(collapsed) {
      if (!appShell) return;
      if (collapsed) {
        appShell.classList.add("inspector-collapsed");
      } else {
        appShell.classList.remove("inspector-collapsed");
      }
    }

    if (closeSidebarBtn) {
      closeSidebarBtn.addEventListener("click", () => {
        setSidebarCollapsed(true);
      });
    }

    if (openSidebarBtn) {
      openSidebarBtn.addEventListener("click", () => {
        setSidebarCollapsed(false);
      });
    }

    if (closeInspectorBtn) {
      closeInspectorBtn.addEventListener("click", () => {
        setInspectorCollapsed(true);
      });
    }

    if (openInspectorBtn) {
      openInspectorBtn.addEventListener("click", () => {
        setInspectorCollapsed(false);
      });
    }

    window.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName))
        return;

      if (e.code === "Space") {
        e.preventDefault();
        const randHue = Math.floor(Math.random() * 360);
        state.primaryHex = ColorUtils.oklchToHex(0.55, 0.16, randHue);
        updatePalette(true);
      } else if (e.key === "c" || e.key === "C") {
        copyToClipboard(exportCodeView.value);
        if (copyExportBtn) {
          const icon = copyExportBtn.querySelector(
            ".material-symbols-outlined",
          );
          const label = copyExportBtn.querySelector(
            "span:not(.material-symbols-outlined)",
          );
          if (icon) icon.textContent = "check";
          if (label) label.textContent = "Copied";
          setTimeout(() => {
            if (icon) icon.textContent = "content_copy";
            if (label) label.textContent = "Copy";
          }, 1400);
        }
      } else if (e.key === "[" || (e.ctrlKey && e.key === "b")) {
        e.preventDefault();
        if (appShell) {
          const isCollapsed = appShell.classList.contains("sidebar-collapsed");
          setSidebarCollapsed(!isCollapsed);
        }
      } else if (e.key === "]") {
        e.preventDefault();
        if (appShell) {
          const isCollapsed = appShell.classList.contains(
            "inspector-collapsed",
          );
          setInspectorCollapsed(!isCollapsed);
        }
      }
    });
  }

  // --- Initialize ---
  loadStateFromUrl();
  setupEventListeners();
  renderPresets();
  updatePalette(true);
});
