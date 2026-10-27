import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        mplus: ["'Zen Kaku Gothic New'", 'sans-serif'],
      },
      screens: {
        xs: "420px",
      },
      colors: {
        // 顧客向けサイト(.u-site)のパレット。値は index.css の --u-* と揃える
        u: {
          sage: "#a4a99d",
          "sage-deep": "#959a8d",
          "sage-light": "#b4b8ad",
          paper: "#f2f1eb",
          "paper-2": "#e8e7df",
          ink: "#1b1c19",
          "ink-2": "#2b2d28",
          copper: "#d38248",
          "copper-deep": "#a95d27",
        },
        sauna: {
          base: "#A4A99D",
          charcoal: "#A4A99D",
          copper: "#A4A99D",
          stone: "#A4A99D",
          wood: "#A4A99D",
          iron: "#A4A99D",
          button: "#B6BAB0",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "fade-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
      writingMode: {
        'vertical-lr': 'vertical-lr',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;