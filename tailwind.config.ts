import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"Fira Code"', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          border:  'hsl(var(--sidebar-border))',
        },
        // Apple system colors
        success: '#34C759',   // Apple green
        danger:  '#FF3B30',   // Apple red
        warn:    '#FF9500',   // Apple orange
        info:    '#007AFF',   // Apple blue
      },
      borderRadius: {
        lg:  'var(--radius)',          // 12px
        md:  'calc(var(--radius) - 2px)', // 10px
        sm:  'calc(var(--radius) - 4px)', // 8px
        xl:  'calc(var(--radius) + 4px)', // 16px
        '2xl': 'calc(var(--radius) + 8px)', // 20px
      },
      boxShadow: {
        'apple-sm':    'var(--shadow-sm)',
        'apple':       'var(--shadow-md)',
        'apple-lg':    'var(--shadow-lg)',
        'apple-card':  'var(--shadow-card)',
        'apple-hover': 'var(--shadow-card-hover)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
        'scale-in':       'scale-in 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
        shimmer:          'shimmer 1.6s infinite linear',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
