/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const rightsBanner = '/*! DisyLab v1.0.3 | Copyright (c) 2026 DisyLab. All rights reserved. | LicenseRef-DisyLab-Proprietary | ash::tya origin build | Unauthorized commercial use, redistribution, white-labeling, relicensing, or removal of this notice is prohibited. | Repository: https://github.com/TyaAsh/DisyLab */'
const disyLabRightsBannerPlugin: Plugin = {
  name: 'disylab-rights-banner',
  enforce: 'post',
  generateBundle(_options, bundle) {
    Object.values(bundle).forEach((output) => {
      if (output.type === 'chunk') output.code = `${rightsBanner}\n${output.code}`
      else if (output.fileName.endsWith('.css') && typeof output.source === 'string') {
        output.source = `${rightsBanner}\n${output.source}`
      }
    })
  },
}

export default defineConfig({
  plugins: [react(), disyLabRightsBannerPlugin],
  server: { port: 1420, host: 'localhost' },
  build: {
    sourcemap: false,
    minify: true,
    cssMinify: true,
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
})
