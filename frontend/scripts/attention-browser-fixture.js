// Test-only camera/pose fixture injected through CDP. Never loaded by the app.
window.__NativeWorker = window.Worker
window.__cameraRequests = 0
window.__cameraSamples = 0
window.__cameraStreams = []
window.__denyCamera = false
window.__pose = { faces: 1, yaw: 0, pitch: 0, boxes: [{ x: .35, y: .25, width: .3, height: .45 }], prototypes: { emotion: { label: 'happy', confidence: .9 } } }
navigator.mediaDevices.getUserMedia = async () => {
  window.__cameraRequests++
  if (window.__denyCamera) throw new DOMException('Test denial', 'NotAllowedError')
  const canvas = document.createElement('canvas')
  canvas.width = 640; canvas.height = 480
  const ctx = canvas.getContext('2d')
  const draw = () => { ctx.fillStyle = '#ccddee'; ctx.fillRect(0, 0, 640, 480) }
  draw()
  const drawing = setInterval(draw, 100)
  const stream = canvas.captureStream(10)
  window.__cameraStreams.push(stream)
  for (const track of stream.getTracks()) {
    const stop = track.stop.bind(track)
    track.stop = () => { clearInterval(drawing); stop() }
  }
  return stream
}
window.Worker = class {
  terminated = false
  postMessage(message) {
    if (message.type === 'frame') message.bitmap.close()
    setTimeout(() => {
      if (this.terminated) return
      if (message.type === 'init') this.onmessage?.({ data: { type: 'ready', prototypesAvailable: true, prototypeModelIds: { emotion: 'a'.repeat(64) } } })
      else { window.__cameraSamples++; this.onmessage?.({ data: { type: 'sample', ...window.__pose } }) }
    }, 0)
  }
  terminate() { this.terminated = true }
}
