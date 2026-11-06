/* A classic worker is intentional: MediaPipe's WASM loader uses importScripts.
   All runtime/model assets are served from this application's own origin. */
let detector
let prototypesAvailable = false
let prototypeModelIds
let lastPrototypeTime = -Infinity
// Each face's extent from its landmarks, as fractions of the frame, so the
// page can outline the face on its own preview at any size.
function faceBox(landmarks) {
  const xs = landmarks.map(p => p.x), ys = landmarks.map(p => p.y)
  const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys))
  return { x, y, width: Math.min(1, Math.max(...xs)) - x, height: Math.min(1, Math.max(...ys)) - y }
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      self.postMessage({ type: 'loading', stage: 'runtime' })
      self.exports = {}
      importScripts(`${data.assetRoot}runtime.js`)
      self.postMessage({ type: 'loading', stage: 'wasm' })
      const { FaceLandmarker, FilesetResolver } = self.exports
      const files = await FilesetResolver.forVisionTasks(`${data.assetRoot}wasm`)
      self.postMessage({ type: 'loading', stage: 'model' })
      detector = await FaceLandmarker.createFromOptions(files, {
        canvas: new OffscreenCanvas(320, 240),
        baseOptions: { modelAssetPath: `${data.assetRoot}face_landmarker.task`, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 2, outputFacialTransformationMatrixes: true,
      })
      try {
        importScripts(`${data.assetRoot}tf.min.js`, `${data.assetRoot}prototype-inference.js`)
        prototypeModelIds = await self.EyeEPPrototypes.load(data.assetRoot)
        prototypesAvailable = true
      } catch (error) {
        self.postMessage({ type: 'loading', stage: `prototype-error: ${String(error)}` })
        // Keep head tracking available when the optional classifiers fail.
        prototypesAvailable = false
      }
      self.postMessage({ type: 'ready', prototypesAvailable, prototypeModelIds })
    } else if (data.type === 'frame') {
      const result = detector.detectForVideo(data.bitmap, data.timestamp)
      const faces = result.faceLandmarks.length
      const m = result.facialTransformationMatrixes[0]?.data
      const valid = faces === 1 && m?.length === 16 && m.every(Number.isFinite) && Math.hypot(m[8], m[9], m[10]) > .01
      let prototypes
      if (prototypesAvailable && data.timestamp - lastPrototypeTime >= 1000) {
        lastPrototypeTime = data.timestamp
        try {
          prototypes = faces === 1 ? await self.EyeEPPrototypes.predict(data.bitmap, result.faceLandmarks[0]) : null
        } catch { prototypes = null }
        prototypes ??= { emotion: { label: 'uncertain', confidence: 0 } }
      }
      self.postMessage({
        type: 'sample', capturedAt: data.timestamp, faces, prototypes, boxes: result.faceLandmarks.map(faceBox),
        yaw: valid ? Math.atan2(m[8], m[10]) * 180 / Math.PI : null,
        pitch: valid ? Math.atan2(-m[9], Math.hypot(m[8], m[10])) * 180 / Math.PI : null,
      })
    }
  } catch {
    self.postMessage({ type: 'error', message: '無法執行攝影機偵測，請關閉後重試；也可以繼續遊戲。' })
  } finally {
    if (data.type === 'frame') data.bitmap.close()
  }
}
