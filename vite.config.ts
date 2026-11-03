import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

/** Commit du build, affiché avec la version du jeu (vide hors d'un dépôt Git) */
const buildCommit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
})();

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    // Serveur du jeu en ligne : VITE_SERVER_URL (ex. wss://seti.onrender.com, à définir sur Netlify) ;
    // en développement, le serveur local (npm run server) ; vide : pas de jeu en ligne
    // Outils de débogage : seulement en développement (npm run dev), jamais dans la version publiée
    __DEBUG_TOOLS__: JSON.stringify(mode === 'development'),
    __SERVER_URL__: JSON.stringify(process.env.VITE_SERVER_URL || (mode === 'development' ? 'ws://localhost:8787' : '')),
  },
  base: './',
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
}));
