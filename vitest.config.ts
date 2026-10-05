import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{js,ts,tsx}'],
    environment: 'node',   // UI tests opt into jsdom with a `@vitest-environment jsdom` comment
  },
});
