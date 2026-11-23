/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Slate blue. No pure white anywhere: the page is a clear blue-grey and
        // the cards are a lighter tint of the same hue, so panels lift off the
        // page without the glare of white on a screen. The header and footer
        // use the page colour, not the card colour, so they read as part of the
        // page rather than as strips laid over it.
        // Every foreground clears WCAG AA (4.5:1) on canvas, panel and raised.
        canvas: "#dde6f3",
        panel: "#f1f5fc",
        raised: "#ccd9ea",
        line: "#bccce3",
        "line-strong": "#9db0ce",
        fg: "#101520",
        muted: "#434b5c",
        faint: "#4d5566",
        accent: { DEFAULT: "#1f47c4", hover: "#18399f", fg: "#ffffff" },
        ok: "#0b5c38",
        warn: "#704709",
        danger: "#a11f1b",
      },
      fontFamily: {
        // Inter for the interface, Plex Mono for hashes, IDs and ledger actions
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tighter: "-0.022em",
      },
      boxShadow: {
        // Cards are lifted by a shadow rather than by being a lighter surface.
        // Tinted toward the page's blue so the shadow reads as depth rather
        // than as grey dirt.
        panel: "0 1px 2px rgba(16, 21, 32, 0.06), 0 1px 3px rgba(16, 21, 32, 0.08)",
        lift: "0 2px 4px rgba(16, 21, 32, 0.06), 0 8px 16px -4px rgba(16, 21, 32, 0.12)",
        float: "0 12px 24px -8px rgba(16, 21, 32, 0.18), 0 32px 64px -16px rgba(16, 21, 32, 0.22)",
        button: "0 1px 2px rgba(16, 21, 32, 0.12)",
        drawer: "-8px 0 32px rgba(16, 21, 32, 0.18)",
      },
    },
  },
  plugins: [],
};
