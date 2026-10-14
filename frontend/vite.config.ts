import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// PDF.js needs local CMaps for Chinese PDFs and decoders for scanned images.
const pdfAssets = ['cmaps', 'standard_fonts', 'wasm'].flatMap((directory) => {
  const root = new URL(`./node_modules/pdfjs-dist/${directory}/`, import.meta.url)
  return readdirSync(root).filter((name) => !name.endsWith('.pdf')).map((name) => ({
    fileName: `pdfjs/${directory}/${name}`,
    path: fileURLToPath(new URL(name, root)),
  }))
})

// Keep the same best_int language models selected by Tesseract's default LSTM
// loader, but serve the engine and models locally with the application.
const coreRoot = new URL('./node_modules/tesseract.js-core/', import.meta.url)
const ocrAssets = [
  ...readdirSync(coreRoot).filter(name => name.endsWith('.wasm') || name.endsWith('.wasm.js')).map(name => ({
    fileName: `ocr/core/${name}`, path: fileURLToPath(new URL(name, coreRoot)),
  })),
  ...['chi_tra', 'eng'].map(language => ({
    fileName: `ocr/lang/${language}.traineddata.gz`,
    path: fileURLToPath(new URL(`./node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`, import.meta.url)),
  })),
]
const localAssets = [...pdfAssets, ...ocrAssets]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'local-document-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0]
        const asset = localAssets.find((item) => path === `${server.config.base}${item.fileName}`)
        if (!asset) return next()
        response.setHeader('Content-Type', asset.fileName.endsWith('.wasm') ? 'application/wasm' : asset.fileName.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        response.end(readFileSync(asset.path))
      })
    },
    generateBundle() {
      for (const asset of localAssets) {
        this.emitFile({ type: 'asset', fileName: asset.fileName, source: readFileSync(asset.path) })
      }
    },
  }],
})
