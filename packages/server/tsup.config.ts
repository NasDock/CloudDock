import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  sourcemap: false,
  clean: true,
  bundle: true,
  noExternal: ['@cloud-dock/shared'],
  external: ['@prisma/client', '.prisma/client'],
})
