/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
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
        brand: {
          orange: "#FF6A00",
          navy: "#0B1F3B",
          "orange-dark": "#C2410C",
          cream: "#FFF3E0",
          danger: "#DC2626",
        },
        status: {
          available: {
            bg: "#DCFCE7",
            text: "#15803D",
            border: "#86EFAC",
          },
          occupied: {
            bg: "#DBEAFE",
            text: "#1D4ED8",
            border: "#93C5FD",
          },
          reserved: {
            bg: "#F3E8FF",
            text: "#7E22CE",
            border: "#D8B4FE",
          },
          cleaning: {
            bg: "#FEF3C7",
            text: "#B45309",
            border: "#FDE68A",
          },
          blocked: {
            bg: "#F3F4F6",
            text: "#374151",
            border: "#D1D5DB",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["Poppins", "Noto Sans Tamil", "system-ui", "sans-serif"],
        sans: ["Inter", "Noto Sans Tamil", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
