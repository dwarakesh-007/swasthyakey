// Serves the production build with the exact headers from vercel.json (CSP pointed at the local backend).
import http from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
const root = new URL('../web/dist/', import.meta.url).pathname
const conf = JSON.parse(readFileSync(new URL('../web/vercel.json', import.meta.url)))
const backend = process.env.BACKEND ?? 'http://localhost:54321'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.gz': 'application/gzip', '.wasm': 'application/wasm' }
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  for (const h of conf.headers.filter((h) => new RegExp('^' + h.source.replace('(.*)', '.*') + '$').test(url)))
    for (const { key, value } of h.headers)
      res.setHeader(key, key === 'Content-Security-Policy' ? value.replace('https://*.supabase.co wss://*.supabase.co', `${backend} ${backend.replace('http', 'ws')}`) : value)
  let file = join(root, url)
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(4173, () => console.log('dist on 4173'))
