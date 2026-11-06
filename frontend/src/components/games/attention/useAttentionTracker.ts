import { useCallback, useEffect, useRef, useState } from 'react'
import type { AttentionPhase, AttentionReport, FaceBox, HeadObservation, PrototypePrediction, TrackerMessage } from '../../../types/attention'
import { AttentionRecorder, classifyHead, emptyPrototypeReport, SAMPLE_FRESH_MS } from './attentionLogic'

type Status = 'off' | 'loading' | 'ready' | 'calibrating' | 'calibrated' | 'error'
export function useAttentionTracker() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const worker = useRef<Worker | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const generation = useRef(0)
  const attempted = useRef(false)
  const active = useRef(false)
  const sessionStarted = useRef(Infinity)
  const baseline = useRef<{ yaw: number; pitch: number } | null>(null)
  const calibration = useRef<{ start: number; samples: { yaw: number; pitch: number }[] } | null>(null)
  const recorder = useRef(new AttentionRecorder())
  const sessionCalibrated = useRef(false)
  const prototypeReport = useRef(emptyPrototypeReport())
  const modelIds = useRef<{ emotion: string } | undefined>(undefined)
  const [prototypeStatus, setPrototypeStatus] = useState<'off' | 'loading' | 'ready' | 'unavailable'>('off')
  const [status, setStatus] = useState<Status>('off')
  const [observation, setObservation] = useState<HeadObservation>('unknown')
  const [message, setMessage] = useState('')
  const [previewPrediction, setPreviewPrediction] = useState<PrototypePrediction | null>(null)
  const [faceBoxes, setFaceBoxes] = useState<FaceBox[]>([])

  const release = useCallback(() => {
    generation.current++
    clearTimeout(timer.current)
    clearTimeout(loadTimer.current)
    worker.current?.terminate()
    worker.current = null
    stream.current?.getTracks().forEach(track => { track.onended = null; track.stop() })
    stream.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    baseline.current = null
    calibration.current = null
    setPreviewPrediction(null)
    setFaceBoxes([])
    recorder.current.observe(performance.now(), 'unknown')
  }, [])

  const stop = useCallback(() => {
    release()
    setStatus('off')
    setObservation('unknown')
    setMessage('')
  }, [release])

  useEffect(() => {
    const visibility = () => { recorder.current.observe(performance.now(), 'unknown'); setPreviewPrediction(null) }
    document.addEventListener('visibilitychange', visibility)
    return () => { document.removeEventListener('visibilitychange', visibility); release() }
  }, [release])

  const start = async () => {
    release()
    const token = generation.current
    attempted.current = true
    modelIds.current = undefined
    setPrototypeStatus('loading')
    setStatus('loading')
    setMessage('正在準備攝影機與模型…')
    const fail = (text: string) => {
      if (generation.current !== token) return
      release()
      setStatus('error')
      setPrototypeStatus('unavailable')
      setMessage(text)
    }
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('請使用 HTTPS 或 localhost 開啟攝影機；也可以直接繼續遊戲。')
      }
      loadTimer.current = setTimeout(() => fail('等待攝影機逾時。請確認瀏覽器攝影機權限；內嵌瀏覽器無法開啟時，請改用 Chrome 後重試。'), 20000)
      const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
      if (generation.current !== token) { camera.getTracks().forEach(track => track.stop()); return }
      clearTimeout(loadTimer.current)
      stream.current = camera
      camera.getVideoTracks().forEach(track => { track.onended = () => fail('攝影機已中斷，請重新開啟；遊戲仍可繼續。') })
      const video = videoRef.current
      if (!video) throw new Error('攝影機預覽尚未準備好，請重試。')
      video.srcObject = camera
      loadTimer.current = setTimeout(() => fail('攝影機沒有提供可播放的畫面。請確認裝置可用，或關閉其他攝影機程式後重試。'), 15000)
      await video.play()
      if (generation.current !== token) return
      clearTimeout(loadTimer.current)
      const assetRoot = new URL(`${import.meta.env.BASE_URL}vision/`, location.origin).href
      const instance = new Worker(`${assetRoot}attention-worker.js`)
      worker.current = instance
      loadTimer.current = setTimeout(() => fail('模型載入逾時，請重新開啟偵測；遊戲仍可繼續。'), 30000)
      const sendFrame = async () => {
        if (generation.current !== token) return
        if (document.hidden || video.readyState < 2) {
          recorder.current.observe(performance.now(), 'unknown')
          timer.current = setTimeout(sendFrame, 180)
          return
        }
        try {
          const bitmap = await createImageBitmap(video, { resizeWidth: 320, resizeHeight: 240 })
          if (generation.current !== token) { bitmap.close(); return }
          instance.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap])
        } catch { fail('無法讀取攝影機畫面，請重新開啟偵測。') }
      }
      instance.onerror = event => { event.preventDefault(); fail('偵測模型無法啟動，請重新開啟；遊戲仍可繼續。') }
      instance.onmessage = ({ data }: MessageEvent<TrackerMessage>) => {
        if (generation.current !== token) return
        if (data.type === 'loading') return
        if (data.type === 'error') { fail(data.message); return }
        if (data.type === 'ready') {
          modelIds.current = data.prototypeModelIds
          setPrototypeStatus(data.prototypesAvailable ? 'ready' : 'unavailable')
          clearTimeout(loadTimer.current)
          setStatus('ready')
          setMessage('請看向螢幕中央，按下「校準正面朝向」。')
        } else {
          const now = performance.now()
          const capturedAt = data.capturedAt ?? now
          const fresh = now - capturedAt <= SAMPLE_FRESH_MS && (!active.current || capturedAt >= sessionStarted.current)
          // The live face outline and expression also run during the test,
          // for the teacher's camera view beside the game.
          setFaceBoxes(fresh && !document.hidden ? data.boxes ?? [] : [])
          if (!fresh || document.hidden || data.faces !== 1) setPreviewPrediction(null)
          else if (data.prototypes) setPreviewPrediction(data.prototypes)
          if (active.current && fresh && !document.hidden && data.prototypes) {
            const stats = prototypeReport.current
            stats.available = true
            stats.modelIds = modelIds.current
            stats.sampleCount++
            stats.expressionCounts[data.prototypes.emotion.label]++
          }
          let value: HeadObservation = 'unknown'
          const valid = fresh && !document.hidden && data.faces === 1 && data.yaw !== null && data.pitch !== null
          const pending = calibration.current
          if (pending) {
            if (valid) pending.samples.push({ yaw: data.yaw!, pitch: data.pitch! })
            if (now - pending.start >= 2400) {
              const samples = pending.samples
              const mean = { yaw: samples.reduce((sum, s) => sum + s.yaw, 0) / samples.length, pitch: samples.reduce((sum, s) => sum + s.pitch, 0) / samples.length }
              const stable = samples.length >= 8 && samples.every(s => Math.abs(s.yaw - mean.yaw) < 8 && Math.abs(s.pitch - mean.pitch) < 8)
              baseline.current = stable ? mean : null
              calibration.current = null
              setStatus(stable ? 'calibrated' : 'ready')
              setMessage(stable ? '校準完成，正式遊戲開始後會記錄頭部朝向。' : '校準未完成，請讓畫面只保留一張臉、保持正面，再試一次。')
            }
          }
          if (valid && baseline.current) value = classifyHead(data.yaw!, data.pitch!, baseline.current)
          recorder.current.observe(now, value, capturedAt)
          if (!active.current) setObservation(value)
        }
        timer.current = setTimeout(sendFrame, 180)
      }
      instance.postMessage({ type: 'init', assetRoot })
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      fail(name === 'NotAllowedError' ? '攝影機權限未開啟。可在瀏覽器設定允許後重試，或直接繼續遊戲。'
        : name === 'NotFoundError' ? '找不到攝影機。接上攝影機後可重試，或直接繼續遊戲。'
          : name === 'NotReadableError' ? '攝影機可能被其他程式使用，請關閉其他攝影機程式後重試。'
            : error instanceof Error ? error.message : '無法開啟攝影機，請重試。')
    }
  }

  const calibrate = () => {
    baseline.current = null
    calibration.current = { start: performance.now(), samples: [] }
    setStatus('calibrating')
    setMessage('請看向螢幕中央，保持正面約 3 秒。')
  }
  const begin = (phase: AttentionPhase) => {
    if (calibration.current) { setStatus('ready'); setMessage('尚未完成校準。') }
    calibration.current = null
    active.current = true
    setPreviewPrediction(null)
    sessionStarted.current = performance.now()
    prototypeReport.current = { ...emptyPrototypeReport(), available: modelIds.current !== undefined, modelIds: modelIds.current }
    sessionCalibrated.current = baseline.current !== null
    recorder.current.begin(sessionStarted.current, phase, new Date().toISOString())
  }
  const setPhase = useCallback((phase: AttentionPhase) => { recorder.current.setPhase(performance.now(), phase) }, [])
  const finish = (): AttentionReport | undefined => {
    active.current = false
    const report = recorder.current.finish(performance.now(), sessionCalibrated.current)
    report.prototypes = structuredClone(prototypeReport.current)
    stop()
    return attempted.current ? report : undefined
  }
  const reset = () => { active.current = false; attempted.current = false; recorder.current.finish(performance.now(), false); stop() }
  return { videoRef, status, prototypeStatus, observation, message, previewPrediction, faceBoxes, start, stop, calibrate, begin, setPhase, finish, reset }
}

export type AttentionTracker = ReturnType<typeof useAttentionTracker>
