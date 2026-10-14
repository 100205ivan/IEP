/* Read-only equivalence checks against the two HTML prototypes. Run from frontend:
   node scripts/verify-games.cjs */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const refs = path.resolve(root, '../references/IEP-test')
const json = value => JSON.parse(JSON.stringify(value))
function random(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 } }
function load(relative, globals = {}) {
  const filename = path.join(root, relative)
  const sandbox = { exports: {}, Math: Object.create(Math), ...globals }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, sandbox, { filename })
  return { exports: sandbox.exports, sandbox }
}
function functionText(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.ok(start >= 0, name)
  const brace = source.indexOf('{', start)
  let depth = 1, end = brace + 1
  while (depth) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++ }
  return source.slice(start, end)
}
const monkeySource = fs.readFileSync(path.join(refs, 'game/monkey/monkey-game/script.js'), 'utf8')
const monkeyReference = { document: { querySelector: () => ({}) }, Math: Object.create(Math) }
vm.runInNewContext(monkeySource.slice(monkeySource.indexOf('  const words'), monkeySource.indexOf('  const stopSpeech')) + '\nglobalThis.api={words,emoji,norms,makePractice,makeQuestions,scoreAnswer}', monkeyReference)
const monkey = load('src/components/games/monkey/monkeyGameLogic.ts')
const monkeyNorms = load('src/components/games/monkey/monkeyNorms.ts').exports
assert.deepEqual(json(monkeyNorms.MONKEY_NORMS), json(monkeyReference.api.norms))
assert.deepEqual(json(monkey.exports.WORDS), json(monkeyReference.api.words))
assert.deepEqual(json(monkey.exports.WORD_EMOJI), json(monkeyReference.api.emoji))
for (let seed = 1; seed <= 200; seed++) {
  monkey.sandbox.Math.random = random(seed); monkeyReference.Math.random = random(seed)
  const practice = monkey.exports.makePractice()
  assert.deepEqual(json(practice), json(monkeyReference.api.makePractice()))
  assert.deepEqual(json(practice.map(q => [q.sequence.length, q.reverse])), [[2, false], [2, false], [3, true], [3, true]])
  const questions = monkey.exports.makeQuestions()
  assert.deepEqual(json(questions), json(monkeyReference.api.makeQuestions()))
  assert.equal(questions.length, 20)
  assert.equal(questions.reduce((n, q) => n + q.sequence.length, 0), 80)
  for (let level = 1; level <= 5; level++) assert.equal(questions.filter(q => q.level === level && q.sequence.length === level + 1).length, 4)
  const answers = questions.map((q, i) => {
    assert.equal(new Set(q.sequence).size, q.sequence.length)
    const player = i % 3 === 0 ? [...q.sequence].reverse() : [...q.sequence]
    const actual = monkey.exports.scoreAnswer(q, player)
    assert.deepEqual(json(actual), json(monkeyReference.api.scoreAnswer(q, player)))
    return actual
  })
  const result = monkey.exports.summarizeResults(answers)
  const correctPositions = answers.reduce((sum, r) => sum + r.correctPositions, 0)
  assert.equal(result.totalScore, correctPositions / 80)
  assert.deepEqual(json(result.levelScores), [1,2,3,4,5].map(level => {
    const subset = answers.filter(r => r.level === level)
    return subset.reduce((s, r) => s + r.score, 0) / subset.length
  }))
}
for (const z of [-3, -2, -1.0001, -1, 0, 1, 1.0001, 2, 3]) {
  assert.equal(monkeyNorms.describeMonkeyPerformance(z), z < -1 ? '較弱' : z > 1 ? '較強' : '一般範圍')
  assert.equal(monkeyNorms.monkeyPerformanceNote(z), z < -2 ? '明顯低於同齡研究平均' : z > 2 ? '明顯高於同齡研究平均' : '')
}
console.log('PASS Monkey: 200 seeded HTML-equivalent question sets, practice, levels, scoring, norms, classification')

const cptSource = fs.readFileSync(path.join(refs, 'game/Continuous Performance Test/script.js'), 'utf8')
const cptReference = { Math: Object.create(Math) }
vm.runInNewContext(cptSource.slice(0, cptSource.indexOf('const $')) + ['buildStimuli', 'randomDuration', 'rateLabel'].map(name => functionText(cptSource, name)).join('\n') + '\nglobalThis.api={norms,buildStimuli,randomDuration,rateLabel}', cptReference)
const cpt = load('src/components/games/cpt/cptGameLogic.ts')
assert.deepEqual(json(load('src/components/games/cpt/cptNorms.ts').exports.CPT_NORMS), json(cptReference.api.norms))
for (let seed = 1; seed <= 1000; seed++) {
  cpt.sandbox.Math.random = random(seed); cptReference.Math.random = random(seed)
  for (const [total, targets] of [[10, 3], [100, 20]]) {
    const stimuli = cpt.exports.buildStimuli(total, targets)
    assert.deepEqual(json(stimuli), json(cptReference.api.buildStimuli(total, targets)))
    assert.equal(stimuli.length, total)
    assert.equal(stimuli.filter(n => n === 7).length, targets)
    assert.ok(stimuli.every((n, i) => n >= 1 && n <= 9 && n !== stimuli[i - 1]))
    const duration = cpt.exports.randomDuration()
    assert.equal(duration, cptReference.api.randomDuration())
    assert.ok(duration >= 1000 && duration <= 2000)
  }
}
for (const value of [0, .5, 1]) { cpt.sandbox.Math.random = () => value; assert.equal(cpt.exports.randomDuration(), 1000 + 1000 * value) }
for (const z of [-3, -.5, -.49, 0, .49, .5, 3]) assert.equal(cpt.exports.rateLabel(z), cptReference.api.rateLabel(z, true))

// Execute the original finishTest against synthetic DOM fields and compare raw metrics.
function originalMetrics(trials) {
  const dom = new Map()
  const sandbox = {
    trials: json(trials), active: false, selectedAge: 8, testStartedAt: 1000,
    Date: { now: () => 2000 }, console: { log() {} }, window: {}, openedFromEyeep: false,
    norms: cptReference.api.norms, TOTAL_TRIALS: 100, show() {},
    $: id => { if (!dom.has(id)) dom.set(id, {}); return dom.get(id) },
    rateLabel: cptReference.api.rateLabel,
  }
  vm.runInNewContext(functionText(cptSource, 'finishTest') + '\nfinishTest()', sandbox)
  const summary = sandbox.window.cptSummary
  return { ...summary, omissionCount: trials.filter(t => t.omission).length, commissionCount: trials.filter(t => t.commission).length }
}
const trial = (isTarget, rt, omission = false) => ({ trialIndex: 1, stimulus: isTarget ? 7 : 2, isTarget, responded: rt !== null, hit: isTarget && rt !== null, omission, commission: !isTarget && rt !== null, reactionTime: rt, startTime: 0 })
for (const trials of [
  [trial(true, 100), trial(true, 300), trial(true, null, true), trial(false, 200), trial(false, null)],
  [trial(true, null, true), trial(false, null)],
  [trial(true, 123), trial(false, null)],
]) assert.deepEqual(json(cpt.exports.summarizeTrials(trials)), json(originalMetrics(trials)))
assert.equal(cpt.exports.summarizeTrials([trial(true,100),trial(true,300),trial(false,null)]).reactionTimeSD, 100)
console.log('PASS CPT: 1000 seeded HTML-equivalent practice/test sequences, adjacency, timing, norms, metrics, population RT SD, zero-hit case')

// Controlled clock verifies the real controller and speech helper without waiting minutes.
function clock() {
  let now = 0, id = 0
  const pending = new Map(), delays = []
  return {
    pending, delays, now: () => now,
    setTimeout(fn, delay) { const key = ++id; delays.push(delay); pending.set(key, { fn, due: now + delay }); return key },
    clearTimeout(key) { pending.delete(key) },
    elapse(ms) { now += ms },
    next() {
      const [key, task] = [...pending].sort((a, b) => a[1].due - b[1].due)[0] || []
      assert.ok(task, 'timer exists'); pending.delete(key); now = task.due; task.fn()
    },
  }
}
const time = clock()
const runtime = load('src/components/games/cpt/cptGameLogic.ts', { setTimeout: time.setTimeout, clearTimeout: time.clearTimeout, performance: { now: time.now }, Date: { now: time.now } })
runtime.sandbox.Math.random = random(42)
let frame, completed, practiceComplete = false, feedbackCount = 0
const session = new runtime.exports.CptSession({ onTrial: v => { frame = v }, onFeedback: () => feedbackCount++, onPracticeComplete: () => practiceComplete = true, onTestComplete: r => completed = r })
session.respond() // no active trial
session.beginPractice()
for (let i = 1; i <= 10; i++) { assert.equal(frame.index, i); assert.equal(frame.total, 10); time.next() }
assert.ok(practiceComplete)
session.beginTest()
let hitIndex = 0, nonTargetIndex = 0
for (let i = 1; i <= 100; i++) {
  assert.equal(frame.index, i); assert.equal(frame.total, 100)
  const shouldRespond = frame.stimulus === 7 ? (++hitIndex % 2 === 0) : (++nonTargetIndex % 4 === 0)
  if (shouldRespond) { time.elapse(100.4); session.respond(); time.elapse(20); session.respond(); assert.equal(frame.index, i) }
  time.next()
}
assert.equal(completed.trials.length, 100)
assert.equal(completed.metrics.hitRate, .5)
assert.equal(completed.metrics.omissionCount, 10)
assert.equal(completed.metrics.commissionCount, 20)
assert.equal(completed.metrics.meanReactionTime, 100)
assert.equal(completed.metrics.reactionTimeSD, 0)
assert.equal(completed.durationMs, completed.testFinishedAt - completed.testStartedAt)
assert.equal(feedbackCount, 10) // practice only
assert.equal(time.pending.size, 0)
session.beginPractice(); session.reset(); assert.equal(time.pending.size, 0)
console.log('PASS CPT controller: 10+100 trials, no response-driven advancement, first response, RT rounding, counts, feedback, cleanup')

for (const error of [false, true]) {
  const time = clock(), spoken = []
  let ready = false, cancelled = 0
  const speech = load('src/components/games/monkey/monkeyGameLogic.ts', {
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    window: { speechSynthesis: { speak: u => spoken.push(u), cancel: () => cancelled++ } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text } },
  })
  const stop = speech.exports.playQuestion(['貓', '狗'], () => ready = true)
  assert.deepEqual(time.delays, [450]); time.next()
  assert.equal(spoken[0].text, '貓'); assert.equal(spoken[0].lang, 'zh-TW'); assert.equal(spoken[0].rate, .78)
  spoken[0][error ? 'onerror' : 'onend'](); time.next()
  assert.equal(spoken[1].text, '狗'); spoken[1].onend(); time.next()
  assert.equal(ready, false); time.next(); assert.equal(ready, true)
  assert.deepEqual(time.delays, [450, error ? 200 : 650, 650, 500])
  stop(); assert.equal(cancelled, 1)
  ready = false; spoken.length = 0
  const cancel = speech.exports.playQuestion(['魚'], () => ready = true); cancel()
  assert.equal(time.pending.size, 0); assert.equal(ready, false)
}
{
  const time = clock(); let ready = false
  const speech = load('src/components/games/monkey/monkeyGameLogic.ts', { window: {}, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout })
  const stop = speech.exports.playQuestion(['貓'], () => ready = true)
  assert.deepEqual(time.delays, [1000]); time.next(); assert.equal(ready, true); stop()
}
assert.equal(monkey.exports.MONKEY_TIMING.nextQuestion, 240)
console.log('PASS Monkey speech: initial 450, onend 650, onerror 200, final 500, fallback 1000, zh-TW/0.78, cancellation, next question 240')
