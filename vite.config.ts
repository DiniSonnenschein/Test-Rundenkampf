import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Die App wird unter https://dinisonnenschein.github.io/Test-Rundenkampf/ veröffentlicht.
export default defineConfig({
  base: '/Test-Rundenkampf/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
});
