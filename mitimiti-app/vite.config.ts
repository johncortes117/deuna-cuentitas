import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// MitiMiti es una PWA: se abre desde un link de WhatsApp sin instalar nada y,
// si la persona quiere, se agrega a la pantalla de inicio como una app.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MitiMiti · Divide la cuenta',
        short_name: 'MitiMiti',
        description: 'Divide la cuenta en la mesa, sin calculadora. Cuentas claras, amistades largas.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBF8F3',
        theme_color: '#FBF8F3',
        categories: ['finance', 'lifestyle', 'social'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Para español basta el subconjunto latino de Inter. Los demás
        // (cirílico, griego, vietnamita, latino extendido) se bajan solo si
        // un nombre los necesita: no se precargan en el celular de nadie.
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,latin-ext}-*.woff2', '**/og.png'],
        // Los datos (Supabase) siempre van a la red: una cuenta vieja en
        // caché sería peor que un aviso de "sin conexión".
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5180 },
  preview: { port: 5181 },
})
