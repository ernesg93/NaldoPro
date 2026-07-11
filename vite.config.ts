import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');

            if (
              normalizedId.includes('/node_modules/@firebase/firestore/') ||
              normalizedId.includes('/node_modules/firebase/firestore/')
            ) {
              return 'vendor-firebase-firestore';
            }

            if (
              normalizedId.includes('/node_modules/@firebase/auth/') ||
              normalizedId.includes('/node_modules/firebase/auth/')
            ) {
              return 'vendor-firebase-auth';
            }

            if (normalizedId.includes('/node_modules/@firebase/') || normalizedId.includes('/node_modules/firebase/')) {
              return 'vendor-firebase';
            }

            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    test: {
      allowOnly: false,
    },
  };
});
