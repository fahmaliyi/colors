/**
 * ColorUtils - Comprehensive Color Science & Harmony Toolkit
 * Provides accurate conversions for sRGB, HEX, HSL, OKLCH, OKLab,
 * WCAG 2.1 / APCA contrast scoring, tonal scale generation, and image palette extraction.
 */

const ColorUtils = (() => {
  // --- Math & Helper Constants ---
  const clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);

  // --- OKLab / OKLCH Transformation Matrices ---
  // sRGB to Linear RGB
  function sRgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  // Linear RGB to sRGB
  function linearToSRgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp(v, 0, 1) * 255);
  }

  // RGB (0-255) -> OKLab [L, a, b]
  function rgbToOklab(r, g, b) {
    const lr = sRgbToLinear(r);
    const lg = sRgbToLinear(g);
    const lb = sRgbToLinear(b);

    const l = Math.cbrt(
      0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
    );
    const m = Math.cbrt(
      0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
    );
    const s = Math.cbrt(
      0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
    );

    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }

  // OKLab [L, a, b] -> RGB [r, g, b]
  function oklabToRgb(L, a, b) {
    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.291485548 * b;

    const l3 = l * l * l;
    const m3 = m * m * m;
    const s3 = s * s * s;

    const lr = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

    return [linearToSRgb(lr), linearToSRgb(lg), linearToSRgb(lb)];
  }

  // OKLab [L, a, b] -> OKLCH [L, C, H] (H in degrees 0-360)
  function oklabToOklch(L, a, b) {
    const C = Math.sqrt(a * a + b * b);
    let H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return [L, C, H];
  }

  // OKLCH [L, C, H] -> OKLab [L, a, b]
  function oklchToOklab(L, C, H) {
    const hRad = (H * Math.PI) / 180;
    return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
  }

  // RGB (0-255) -> OKLCH [L, C, H]
  function rgbToOklch(r, g, b) {
    const [L, a, labB] = rgbToOklab(r, g, b);
    return oklabToOklch(L, a, labB);
  }

  // OKLCH [L, C, H] -> RGB [r, g, b]
  function oklchToRgb(L, C, H) {
    const [labL, a, b] = oklchToOklab(L, C, H);
    return oklabToRgb(labL, a, b);
  }

  // HEX <-> RGB
  function hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return null;
    let clean = hex.replace("#", "").trim();
    if (clean.length === 3) {
      clean = clean
        .split("")
        .map((ch) => ch + ch)
        .join("");
    }
    if (clean.length !== 6) return null;
    const num = parseInt(clean, 16);
    if (isNaN(num)) return null;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function rgbToHex(r, g, b) {
    const toHex = (n) =>
      Math.round(clamp(n, 0, 255))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  function oklchToHex(L, C, H) {
    const [r, g, b] = oklchToRgb(L, C, H);
    return rgbToHex(r, g, b);
  }

  function hexToOklch(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    return rgbToOklch(...rgb);
  }

  // RGB <-> HSL
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function hslToRgb(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // --- Accessibility: WCAG 2.1 Relative Luminance & Contrast ---
  function getRelativeLuminance(r, g, b) {
    const rs = sRgbToLinear(r);
    const gs = sRgbToLinear(g);
    const bs = sRgbToLinear(b);
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function getContrastRatio(hex1, hex2) {
    const rgb1 = hexToRgb(hex1) || [0, 0, 0];
    const rgb2 = hexToRgb(hex2) || [255, 255, 255];
    const l1 = getRelativeLuminance(...rgb1);
    const l2 = getRelativeLuminance(...rgb2);
    const brighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (brighter + 0.05) / (darker + 0.05);
  }

  function getWcagRating(ratio) {
    return {
      ratio: ratio.toFixed(2),
      aaNormal: ratio >= 4.5,
      aaLarge: ratio >= 3.0,
      aaaNormal: ratio >= 7.0,
      aaaLarge: ratio >= 4.5,
      badge:
        ratio >= 7.0
          ? "AAA"
          : ratio >= 4.5
            ? "AA"
            : ratio >= 3.0
              ? "AA Large"
              : "Fail",
    };
  }

  // Determine best foreground text color (Black or White) for a background
  function getReadableTextColor(bgHex) {
    const ratioWithWhite = getContrastRatio(bgHex, "#FFFFFF");
    const ratioWithBlack = getContrastRatio(bgHex, "#0F172A");
    return ratioWithWhite >= ratioWithBlack ? "#FFFFFF" : "#0F172A";
  }

  // --- Tonal Scale Generation (Systematic 50 to 950 - better-colors) ---
  const TONAL_STEPS = [
    { name: "50", lightness: 0.98, chromaFactor: 0.18 },
    { name: "100", lightness: 0.94, chromaFactor: 0.32 },
    { name: "200", lightness: 0.88, chromaFactor: 0.55 },
    { name: "300", lightness: 0.8, chromaFactor: 0.78 },
    { name: "400", lightness: 0.7, chromaFactor: 0.92 },
    { name: "500", lightness: 0.58, chromaFactor: 1.0 }, // Solid fill base
    { name: "600", lightness: 0.48, chromaFactor: 0.98 },
    { name: "700", lightness: 0.38, chromaFactor: 0.88 },
    { name: "800", lightness: 0.28, chromaFactor: 0.72 },
    { name: "900", lightness: 0.18, chromaFactor: 0.5 },
    { name: "950", lightness: 0.1, chromaFactor: 0.28 },
  ];

  function generateTonalScale(baseHex) {
    const oklch = hexToOklch(baseHex) || [0.55, 0.15, 260];
    const [_, baseChroma, hue] = oklch;
    const targetChroma = Math.min(baseChroma, 0.28);

    return TONAL_STEPS.map((step) => {
      const stepL = step.lightness;
      const stepC = targetChroma * step.chromaFactor;
      const hex = oklchToHex(stepL, stepC, hue);
      const text = stepL > 0.6 ? "#0F172A" : "#FFFFFF";
      return {
        step: step.name,
        hex,
        oklch: `oklch(${stepL.toFixed(2)} ${stepC.toFixed(3)} ${Math.round(hue)})`,
        lightness: stepL,
        text,
        contrast: getContrastRatio(hex, text).toFixed(1),
      };
    });
  }

  // --- Harmonic Palette Generation Modes ---
  function generateHarmonies(baseHex, mode = "analogous", count = 5) {
    const oklch = hexToOklch(baseHex) || [0.55, 0.15, 260];
    const [L, C, H] = oklch;
    const colors = [];

    switch (mode) {
      case "monochromatic": {
        const lSteps = [0.85, 0.7, 0.55, 0.4, 0.25];
        const cSteps = [C * 0.5, C * 0.8, C, C * 0.9, C * 0.6];
        for (let i = 0; i < count; i++) {
          const l = lSteps[i % lSteps.length];
          const c = cSteps[i % cSteps.length];
          colors.push(oklchToHex(l, c, H));
        }
        break;
      }
      case "analogous": {
        const offsets = [-40, -20, 0, 20, 40];
        for (let i = 0; i < count; i++) {
          const offset = offsets[i % offsets.length];
          const h = (H + offset + 360) % 360;
          colors.push(oklchToHex(L, C, h));
        }
        break;
      }
      case "complementary": {
        const offsets = [0, 180, 20, 200, 40];
        const lAdjust = [0, 0.05, -0.05, 0.08, -0.08];
        for (let i = 0; i < count; i++) {
          const h = (H + offsets[i] + 360) % 360;
          const l = clamp(L + lAdjust[i], 0.25, 0.85);
          colors.push(oklchToHex(l, C, h));
        }
        break;
      }
      case "split": {
        const offsets = [0, 150, 210, 30, 180];
        for (let i = 0; i < count; i++) {
          const h = (H + offsets[i] + 360) % 360;
          colors.push(oklchToHex(L, C, h));
        }
        break;
      }
      case "triadic": {
        const offsets = [0, 120, 240, 60, 180];
        for (let i = 0; i < count; i++) {
          const h = (H + offsets[i] + 360) % 360;
          colors.push(oklchToHex(L, C, h));
        }
        break;
      }
      case "tetradic": {
        const offsets = [0, 60, 180, 240, 30];
        for (let i = 0; i < count; i++) {
          const h = (H + offsets[i] + 360) % 360;
          colors.push(oklchToHex(L, C, h));
        }
        break;
      }
      default: {
        const offsets = [0, 35, -35, 180, 210];
        for (let i = 0; i < count; i++) {
          const h = (H + offsets[i] + 360) % 360;
          colors.push(oklchToHex(L, C, h));
        }
      }
    }
    return colors;
  }

  // --- Semantic Theme Token Derivation (Light & Dark - better-colors) ---
  function deriveFullSystemTokens(primaryHex) {
    const oklch = hexToOklch(primaryHex) || [0.55, 0.15, 260];
    const [L, C, H] = oklch;

    const secondaryHue = (H + 35) % 360;
    const accentHue = (H + 180) % 360;

    const primaryLight = oklchToHex(0.54, Math.min(C, 0.22), H);
    const primaryDark = oklchToHex(0.68, Math.min(C * 0.9, 0.18), H);

    const secondaryLight = oklchToHex(
      0.55,
      Math.min(C * 0.75, 0.14),
      secondaryHue,
    );
    const secondaryDark = oklchToHex(
      0.72,
      Math.min(C * 0.75, 0.14),
      secondaryHue,
    );

    const accentLight = oklchToHex(0.56, Math.min(C, 0.22), accentHue);
    const accentDark = oklchToHex(0.72, Math.min(C, 0.22), accentHue);

    // Neutrals (Pure Tonal Surface System)
    const bgLight = "#FCFCFC";
    const subtleLight = "#F4F4F5";
    const surfaceLight = "#ECECEF";
    const raisedLight = "#FFFFFF";
    const sunkenLight = "#E3E3E7";
    const textPrimaryLight = oklchToHex(0.18, 0.005, 80);
    const textSecondaryLight = oklchToHex(0.44, 0.005, 80);
    const textMutedLight = oklchToHex(0.6, 0.005, 80);

    const bgDark = "#101010";
    const subtleDark = "#151515";
    const surfaceDark = "#1C1C1C";
    const raisedDark = "#262626";
    const sunkenDark = "#0C0C0C";
    const textPrimaryDark = oklchToHex(0.98, 0.002, 80);
    const textSecondaryDark = oklchToHex(0.76, 0.005, 80);
    const textMutedDark = oklchToHex(0.55, 0.005, 80);

    // Status colors
    const successHex = oklchToHex(0.6, 0.17, 142);
    const warningHex = oklchToHex(0.72, 0.18, 75);
    const dangerHex = oklchToHex(0.58, 0.22, 28);
    const infoHex = oklchToHex(0.6, 0.16, 235);

    return {
      primary: primaryHex,
      hue: Math.round(H),
      chroma: parseFloat(C.toFixed(3)),
      lightness: parseFloat(L.toFixed(3)),
      light: {
        background: bgLight,
        subtle: subtleLight,
        surface: surfaceLight,
        surfaceRaised: raisedLight,
        surfaceSunken: sunkenLight,
        primary: primaryLight,
        onPrimary: "#FFFFFF",
        primaryContainer: oklchToHex(0.94, Math.min(C * 0.35, 0.05), H),
        onPrimaryContainer: oklchToHex(0.25, Math.min(C, 0.2), H),
        secondary: secondaryLight,
        onSecondary: "#FFFFFF",
        accent: accentLight,
        textPrimary: textPrimaryLight,
        textSecondary: textSecondaryLight,
        textMuted: textMutedLight,
        success: successHex,
        warning: warningHex,
        danger: dangerHex,
        info: infoHex,
      },
      dark: {
        background: bgDark,
        subtle: subtleDark,
        surface: surfaceDark,
        surfaceRaised: raisedDark,
        surfaceSunken: sunkenDark,
        primary: primaryDark,
        onPrimary: "#0F172A",
        primaryContainer: oklchToHex(0.26, Math.min(C * 0.5, 0.08), H),
        onPrimaryContainer: oklchToHex(0.94, Math.min(C * 0.35, 0.06), H),
        secondary: secondaryDark,
        onSecondary: "#0F172A",
        accent: accentDark,
        textPrimary: textPrimaryDark,
        textSecondary: textSecondaryDark,
        textMuted: textMutedDark,
        success: oklchToHex(0.72, 0.16, 142),
        warning: oklchToHex(0.8, 0.16, 75),
        danger: oklchToHex(0.7, 0.2, 28),
        info: oklchToHex(0.72, 0.15, 235),
      },
    };
  }

  // --- Color Blindness Simulation Matrices ---
  const COLORBLIND_MATRICES = {
    normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    protanopia: [
      0.56667, 0.43333, 0.0, 0.55833, 0.44167, 0.0, 0.0, 0.24167, 0.75833,
    ],
    deuteranopia: [0.625, 0.375, 0.0, 0.7, 0.3, 0.0, 0.0, 0.3, 0.7],
    tritanopia: [0.95, 0.05, 0.0, 0.0, 0.433, 0.567, 0.0, 0.475, 0.525],
    achromatopsia: [
      0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114,
    ],
  };

  function simulateColorblindness(hex, type = "protanopia") {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const m = COLORBLIND_MATRICES[type] || COLORBLIND_MATRICES.normal;
    const [r, g, b] = rgb;
    const sr = clamp(r * m[0] + g * m[1] + b * m[2], 0, 255);
    const sg = clamp(r * m[3] + g * m[4] + b * m[5], 0, 255);
    const sb = clamp(r * m[6] + g * m[7] + b * m[8], 0, 255);
    return rgbToHex(sr, sg, sb);
  }

  // --- Image Color Extraction ---
  function extractPaletteFromImageData(imgElement, maxColors = 5) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const maxDimension = 150;
        let w = imgElement.naturalWidth || imgElement.width || 150;
        let h = imgElement.naturalHeight || imgElement.height || 150;

        if (w > h) {
          if (w > maxDimension) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          }
        } else {
          if (h > maxDimension) {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imgElement, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h).data;
        const colorBuckets = {};

        const step = 4;
        for (let i = 0; i < imgData.length; i += 4 * step) {
          const a = imgData[i + 3];
          if (a < 128) continue;
          const r = Math.round(imgData[i] / 16) * 16;
          const g = Math.round(imgData[i + 1] / 16) * 16;
          const b = Math.round(imgData[i + 2] / 16) * 16;
          const key = `${r},${g},${b}`;
          colorBuckets[key] = (colorBuckets[key] || 0) + 1;
        }

        const sorted = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxColors * 4)
          .map(([key]) => {
            const [r, g, b] = key.split(",").map(Number);
            return rgbToHex(r, g, b);
          });

        const distinctColors = [];
        for (const hex of sorted) {
          const isTooClose = distinctColors.some((dHex) => {
            const c1 = hexToRgb(hex);
            const c2 = hexToRgb(dHex);
            const dist = Math.sqrt(
              Math.pow(c1[0] - c2[0], 2) +
                Math.pow(c1[1] - c2[1], 2) +
                Math.pow(c1[2] - c2[2], 2),
            );
            return dist < 45;
          });

          if (!isTooClose) {
            distinctColors.push(hex);
          }
          if (distinctColors.length >= maxColors) break;
        }

        while (distinctColors.length < maxColors) {
          distinctColors.push(
            distinctColors[distinctColors.length - 1] || "#6366F1",
          );
        }

        resolve(distinctColors);
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- Curated Preset Palettes ---
  const PRESETS = [
    {
      name: "Indigo Modern",
      primary: "#6366F1",
      colors: ["#6366F1", "#4F46E5", "#818CF8", "#06B6D4", "#F43F5E"],
      category: "Tech SaaS",
    },
    {
      name: "Linear Obsidian",
      primary: "#5E6AD2",
      colors: ["#5E6AD2", "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B"],
      category: "Dark Minimal",
    },
    {
      name: "Emerald Eco",
      primary: "#10B981",
      colors: ["#10B981", "#059669", "#34D399", "#14B8A6", "#84CC16"],
      category: "Nature",
    },
    {
      name: "Nordic Frost",
      primary: "#38BDF8",
      colors: ["#38BDF8", "#0284C7", "#7DD3FC", "#818CF8", "#C084FC"],
      category: "Clean Cool",
    },
    {
      name: "Sunset Ember",
      primary: "#F97316",
      colors: ["#F97316", "#EA580C", "#FB923C", "#EC4899", "#F43F5E"],
      category: "Warm & Vibrant",
    },
    {
      name: "Neo Tokyo",
      primary: "#D946EF",
      colors: ["#D946EF", "#C026D3", "#E879F9", "#06B6D4", "#3B82F6"],
      category: "Cyberpunk",
    },
    {
      name: "Apple Neutral",
      primary: "#0071E3",
      colors: ["#0071E3", "#0077ED", "#5AC8FA", "#34C759", "#FF9500"],
      category: "Clean Tech",
    },
    {
      name: "Amber Gold",
      primary: "#D97706",
      colors: ["#D97706", "#B45309", "#FBBF24", "#78350F", "#92400E"],
      category: "Warm Classic",
    },
  ];

  return {
    rgbToOklab,
    oklabToRgb,
    oklabToOklch,
    oklchToOklab,
    rgbToOklch,
    oklchToRgb,
    hexToRgb,
    rgbToHex,
    oklchToHex,
    hexToOklch,
    rgbToHsl,
    hslToRgb,
    getRelativeLuminance,
    getContrastRatio,
    getWcagRating,
    getReadableTextColor,
    generateTonalScale,
    generateTonalPalette: generateTonalScale,
    generateHarmonies,
    deriveFullSystemTokens,
    simulateColorblindness,
    extractPaletteFromImageData,
    PRESETS,
    TONAL_STEPS,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = ColorUtils;
}
