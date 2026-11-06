/* Architecture and preprocessing match ml/train_prototypes.py.
   These classifiers predict dataset labels, not internal emotion/attention. */
(() => {
  const models = {}
  function build(config) {
    const model = tf.sequential()
    for (const [index, filters] of [16, 32, 64].entries()) {
      model.add(tf.layers.conv2d({ filters, kernelSize: 3, padding: 'same', activation: 'relu', ...(index === 0 ? { inputShape: [config.inputSize, config.inputSize, config.channels] } : {}) }))
      model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }))
    }
    model.add(tf.layers.flatten())
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }))
    model.add(tf.layers.dense({ units: config.classes.length, activation: 'softmax' }))
    return model
  }
  async function load(root, names = ['emotion']) {
    await tf.setBackend('cpu')
    await tf.ready()
    for (const name of names) {
      if (name === 'emotion') {
        const upstream = await fetch(`${root}prototypes/emotion-ferplus.json`)
        if (upstream.ok) {
          const config = await upstream.json()
          importScripts(`${root}ort/ort.wasm.min.js`)
          ort.env.wasm.wasmPaths = `${root}ort/`
          ort.env.wasm.numThreads = 1
          const weightsResponse = await fetch(`${root}prototypes/${config.modelFile}`)
          if (!weightsResponse.ok) throw Error('FER+ weights unavailable')
          const buffer = await weightsResponse.arrayBuffer()
          const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2, '0')).join('')
          if (digest !== config.modelSha256) throw Error('FER+ weights checksum mismatch')
          const session = await ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] })
          models[name] = { session, config: { ...config, channels: 1, weightsSha256: digest } }
          continue
        }
        throw Error('Validated FER+ model manifest unavailable')
      }
      const response = await fetch(`${root}prototypes/${name}.json`)
      if (!response.ok) throw Error('Prototype manifest unavailable')
      const config = await response.json()
      if (config.architecture !== 'eyeep-small-cnn-v1' || !config.researchOnly) throw Error('Unsupported model')
      const weightsResponse = await fetch(`${root}prototypes/${config.weightsFile}`)
      if (!weightsResponse.ok) throw Error('Prototype weights unavailable')
      const buffer = await weightsResponse.arrayBuffer()
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2, '0')).join('')
      if (digest !== config.weightsSha256) throw Error('Prototype weights checksum mismatch')
      const floats = new Float32Array(buffer)
      let offset = 0
      const weights = config.weightShapes.map(shape => {
        const count = shape.reduce((a, b) => a * b, 1)
        const weight = tf.tensor(floats.subarray(offset, offset + count), shape)
        offset += count
        return weight
      })
      if (offset !== floats.length) throw Error('Invalid weight count')
      const model = build(config)
      model.setWeights(weights)
      weights.forEach(tensor => tensor.dispose())
      models[name] = { model, config }
    }
    return Object.fromEntries(Object.entries(models).map(([name, value]) => [name, value.config.weightsSha256]))
  }
  async function predictPixels(name, pixels) {
    const { model, config, session } = models[name]
    if (session) {
      const tensor = new ort.Tensor('float32', Float32Array.from(pixels, value => value * 255), [1, 1, 64, 64])
      const outputs = await session.run({ [session.inputNames[0]]: tensor })
      const values = Array.from(outputs[session.outputNames[0]].data)
      const max = Math.max(...values)
      const exponentials = values.map(n => Math.exp(n - max))
      const sum = exponentials.reduce((a, b) => a + b, 0)
      return exponentials.map(n => n / sum)
    }
    const result = tf.tidy(() => model.predict(tf.tensor4d(pixels, [1, config.inputSize, config.inputSize, config.channels])))
    try { return Array.from(await result.data()) } finally { result.dispose() }
  }
  async function predictImage(name, bitmap, box) {
    const { config } = models[name]
    const canvas = new OffscreenCanvas(config.inputSize, config.inputSize)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height)
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const pixels = new Float32Array(config.inputSize * config.inputSize * config.channels)
    for (let i = 0, j = 0; i < rgba.length; i += 4) {
      if (config.channels === 1) pixels[j++] = (.299 * rgba[i] + .587 * rgba[i + 1] + .114 * rgba[i + 2]) / 255
      else { pixels[j++] = rgba[i] / 255; pixels[j++] = rgba[i + 1] / 255; pixels[j++] = rgba[i + 2] / 255 }
    }
    const scores = await predictPixels(name, pixels)
    const confidence = Math.max(...scores)
    return { label: confidence >= config.threshold ? config.classes[scores.indexOf(confidence)] : 'uncertain', confidence }
  }
  async function predict(bitmap, landmarks) {
    const xs = landmarks.map(p => p.x * bitmap.width), ys = landmarks.map(p => p.y * bitmap.height)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const x = Math.max(0, minX - (maxX - minX) * .1), y = Math.max(0, minY - (maxY - minY) * .1)
    const face = { x, y, width: Math.min(bitmap.width, maxX + (maxX - minX) * .1) - x, height: Math.min(bitmap.height, maxY + (maxY - minY) * .1) - y }
    if (face.width < 20 || face.height < 20) return null
    return {
      emotion: await predictImage('emotion', bitmap, face),
    }
  }
  async function parity(root) {
    const results = {}
    for (const name of Object.keys(models)) {
      const { config } = models[name]
      const length = config.inputSize ** 2 * config.channels
      const pixels = Float32Array.from({ length }, (_, i) => i / (length - 1))
      const actual = await predictPixels(name, pixels)
      if (config.architecture === 'onnx-ferplus-8') {
        const logits = config.expectedSyntheticLogits
        const max = Math.max(...logits)
        const exp = logits.map(n => Math.exp(n - max)), sum = exp.reduce((a, b) => a + b, 0)
        const expected = exp.map(n => n / sum)
        results[name] = { maxError: Math.max(...actual.map((n, i) => Math.abs(n - expected[i]))), actual, expected }
        continue
      }
      const response = await fetch(`${root}prototypes/${name}.parity.json`)
      const { expected } = await response.json()
      results[name] = { maxError: Math.max(...actual.map((n, i) => Math.abs(n - expected[i]))), actual, expected }
    }
    return results
  }
  self.EyeEPPrototypes = { load, predict, parity }
})()
