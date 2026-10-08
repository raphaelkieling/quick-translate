// Renders video/scene.html frame by frame with headless Chrome (DevTools Protocol, no dependencies) and encodes it with ffmpeg.
//   node video/render.mjs                      -> docs/demo.mp4, on the website and in the README (60 fps, 1920x1080, length set by the scene)
//   node video/render.mjs --stills 0.5,2,6     -> video/stills/*.png, to check single moments
//   node video/render.mjs --scale 2            -> renders at 2x and downsamples, for smoother edges
//   node video/render.mjs --audio-only         -> only redoes the soundtrack (video/audio.mjs) on the existing video
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderSoundtrack } from './audio.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const WIDTH = 1920
const HEIGHT = 1080
const FPS = 60

const argv = process.argv.slice(2)
const option = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const stills = option('stills')?.split(',').map(Number)
const scale = Number(option('scale') || 1)
const output = option('out') || join(here, '..', 'docs', 'demo.mp4')
const audioOnly = argv.includes('--audio-only')

const run = (args, stdin = 'ignore') => {
  const child = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: [stdin, 'inherit', 'inherit'] })
  child.done = new Promise((resolve, reject) =>
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))),
  )
  return child
}
const AUDIO = ['-c:a', 'aac', '-b:a', '256k']

const profile = await mkdtemp(join(tmpdir(), 'qt-video-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--allow-file-access-from-files',
  '--hide-scrollbars',
  '--font-render-hinting=none',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  'about:blank',
])

const browserUrl = await new Promise((resolve, reject) => {
  let log = ''
  chrome.stderr.on('data', (chunk) => {
    log += chunk
    const match = log.match(/DevTools listening on (ws:\/\/\S+)/)
    if (match) resolve(match[1])
  })
  chrome.on('exit', () => reject(new Error(`Chrome exited:\n${log}`)))
})

const port = new URL(browserUrl).port
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

let nextId = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  if (message.error) request.reject(new Error(message.error.message))
  else request.resolve(message.result)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text)
  return result.value
}

await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: scale, mobile: false })
await send('Page.navigate', { url: pathToFileURL(join(here, 'scene.html')).href })
while (!(await evaluate('window.sceneReady === true').catch(() => false))) await new Promise((r) => setTimeout(r, 50))
const DURATION = await evaluate('window.sceneDuration')

const frame = async (t) => {
  await evaluate(`renderFrame(${t})`)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  return Buffer.from(data, 'base64')
}

try {
  const soundtrack = join(profile, 'soundtrack.wav')
  if (!stills) await writeFile(soundtrack, renderSoundtrack({ duration: DURATION, cues: await evaluate('window.sceneCues()') }))

  if (audioOnly) {
    const remuxed = join(profile, 'remuxed.mp4')
    await run(['-i', output, '-i', soundtrack, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...AUDIO, '-movflags', '+faststart', remuxed]).done
    await rename(remuxed, output)
    console.log(`Updated the soundtrack of ${output}`)
  } else if (stills) {
    const dir = join(here, 'stills')
    await mkdir(dir, { recursive: true })
    for (const t of stills) await writeFile(join(dir, `${t.toFixed(2).padStart(5, '0')}.png`), await frame(t))
    console.log(`Wrote ${stills.length} stills to ${dir}`)
  } else {
    const ffmpeg = run(
      [
        '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
        '-i', soundtrack,
        '-map', '0:v', '-map', '1:a',
        '-vf', `scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high',
        ...AUDIO,
        '-r', String(FPS), '-movflags', '+faststart',
        output,
      ],
      'pipe',
    )
    const total = FPS * DURATION
    for (let i = 0; i < total; i++) {
      const png = await frame(i / FPS)
      if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
      if (i % 60 === 0) process.stdout.write(`\rframe ${i}/${total}`)
    }
    ffmpeg.stdin.end()
    await ffmpeg.done
    console.log(`\rWrote ${output}`)
  }
} finally {
  ws.close()
  const exited = new Promise((resolve) => chrome.once('exit', resolve))
  chrome.kill()
  await exited
  await rm(profile, { recursive: true, force: true, maxRetries: 5 })
}
