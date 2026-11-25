/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Apple-style neutrals: the page alternates between pure white and a
        // soft grey (#f5f5f7), cards are white on grey and grey on white, and
        // a single system blue carries every action.
        // Every foreground clears WCAG AA (4.5:1) on canvas, panel and raised.
        canvas: "#f5f5f7",
        panel: "#ffffff",
        raised: "#ebebef",
        line: "#d2d2d7",
        "line-strong": "#b8b8bf",
        fg: "#1d1d1f",
        muted: "#5f5f64",
        faint: "#636368",
        accent: { DEFAULT: "#0066cc", hover: "#0058b0", fg: "#ffffff" },
        ok: "#1a7f37",
        warn: "#8a5300",
        danger: "#c4251c",
      },
      fontFamily: {
        // San Francisco on Apple devices, Inter everywhere else
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Inter"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ['"SF Mono"', "ui-monospace", '"IBM Plex Mono"', "Menlo", "monospace"],
      },
      letterSpacing: {
        tighter: "-0.022em",
        display: "-0.035em",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.04)",
        lift: "0 4px 14px rgba(0, 0, 0, 0.06), 0 12px 32px -8px rgba(0, 0, 0, 0.10)",
        float: "0 20px 48px -12px rgba(0, 0, 0, 0.18), 0 40px 80px -24px rgba(0, 0, 0, 0.16)",
        button: "none",
        drawer: "-8px 0 40px rgba(0, 0, 0, 0.12)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.28, 0.11, 0.32, 1)",
      },
    },
  },
  plugins: [],
};
