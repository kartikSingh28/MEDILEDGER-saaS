/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Refined dark: flat near-black surfaces, one teal accent
        canvas: "#0d0f12",
        panel: "#14171c",
        raised: "#1b1f26",
        line: "#262b33",
        "line-strong": "#353c47",
        fg: "#e7e9ec",
        muted: "#9aa3ae",
        faint: "#6b7380",
        accent: { DEFAULT: "#4fb8a8", hover: "#62c8b8", fg: "#0b1513" },
        ok: "#5cb784",
        warn: "#d9a94a",
        danger: "#e2706f",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
