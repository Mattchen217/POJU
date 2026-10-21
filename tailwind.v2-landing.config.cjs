/** @type {import('tailwindcss').Config} */
/**
 * Standalone Tailwind build for public/v2-landing.html (iframe landing).
 * Do NOT use cdn.tailwindcss.com — that compiles utilities on the main thread.
 */
module.exports = {
  darkMode: "class",
  content: ["./public/v2-landing.html"],
  safelist: [
    // Toggled from landing JS (auth / locale chrome)
    "bg-white/12",
    "text-white",
    "inline-flex",
    "hidden",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#D4AF37",
        "background-light": "#f8fafc",
        "background-dark": "#000000",
      },
      fontFamily: {
        display: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
        sans: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
