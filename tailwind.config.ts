import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-deep": "var(--bg-deep)",
        "bg-layer-1": "var(--bg-layer-1)",
        "bg-layer-2": "var(--bg-layer-2)",
        "glass-tint": "var(--glass-tint)",
        "glass-border": "var(--glass-border)",
        "purple-primary": "var(--purple-primary)",
        "purple-bright": "var(--purple-bright)",
        "purple-vivid": "var(--purple-vivid)",
        "purple-pink": "var(--purple-pink)",
        "purple-deep": "var(--purple-deep)",
        "gold-rare": "var(--gold-rare)",
        "cyan-primary": "var(--cyan-primary)",
        "cyan-bright": "var(--cyan-bright)",
        "text-primary": "var(--text-primary)",
        "text-body": "var(--text-body)",
        "text-secondary": "var(--text-secondary)",
        "text-dim": "var(--text-dim)",
        "text-accent": "var(--text-accent)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
      },
      fontFamily: {
        primary: "var(--font-primary)",
        verse: "var(--font-verse)",
        logo: "var(--font-logo-zh)",
      },
      transitionDuration: {
        instant: "100ms",
        quick: "200ms",
        smooth: "300ms",
        slow: "500ms",
        ornate: "1000ms",
        epic: "2500ms",
      },
    },
  },
  plugins: [],
};

export default config;
