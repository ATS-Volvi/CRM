/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          'primary-foreground': "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          'accent-foreground': "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        
        // Legacy semantic aliases mapping old Horizon Enterprise themes to the new design tokens
        surface: "hsl(var(--background))",
        'surface-dim': "hsl(var(--muted))",
        'surface-bright': "hsl(var(--background))",
        'surface-container-lowest': "hsl(var(--card))",
        'surface-container-low': "hsl(var(--muted))",
        'surface-container': "hsl(var(--secondary))",
        'surface-container-high': "hsl(var(--secondary))",
        'surface-container-highest': "hsl(var(--muted))",
        'on-surface': "hsl(var(--foreground))",
        'on-surface-variant': "hsl(var(--muted-foreground))",
        'inverse-surface': "hsl(var(--foreground))",
        'inverse-on-surface': "hsl(var(--background))",
        outline: "hsl(var(--muted-foreground))",
        'outline-variant': "hsl(var(--border))",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" }
        },
        "slide-in": {
          from: { opacity: 0, transform: "translateX(-12px)" },
          to: { opacity: 1, transform: "translateX(0)" }
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 8px 0 hsl(var(--primary)/0.3)" },
          "50%": { boxShadow: "0 0 20px 4px hsl(var(--primary)/0.5)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      }
    },
  },
  plugins: [],
}
