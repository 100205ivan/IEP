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
// Norms are now Van de Weijer-Bergsma et al. (2016), Table 2, by grade (see the browser checks), not the HTML prototype's age table.
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
  assert.equal(result.correctPositions, correctPositions); assert.equal(result.totalPositions, 80)
  // The paper's outcome: the mean of each question's proportion correct.
  assert.ok(Math.abs(result.totalScore - answers.reduce((s, r) => s + r.score, 0) / 20) < 1e-12)
  assert.deepEqual(json(result.levelScores), [1,2,3,4,5].map(level => {
    const subset = answers.filter(r => r.level === level)
    return subset.reduce((s, r) => s + r.score, 0) / subset.length
  }))
}
console.log('PASS Monkey: 200 seeded HTML-equivalent question sets, practice, levels, mean proportion scoring')

const cptSource = fs.readFileSync(path.join(refs, 'game/Continuous Performance Test/script.js'), 'utf8')
const cptReference = { Math: Object.create(Math) }
vm.runInNewContext(cptSource.slice(0, cptSource.indexOf('const $')) + ['buildStimuli', 'randomDuration', 'rateLabel'].map(name => functionText(cptSource, name)).join('\n') + '\nglobalThis.api={norms,buildStimuli,randomDuration,rateLabel}', cptReference)
const cpt = load('src/components/games/cpt/cptGameLogic.ts')
// Reference values are Kanaka et al. (2008), Tables 1 and 2: all 10 parameters for ages 5–12.
const cptNorms = load('src/components/games/cpt/cptNorms.ts').exports
assert.deepEqual(Object.keys(cptNorms.CPT_NORMS).map(Number), [5, 6, 7, 8, 9, 10, 11, 12])
for (const norm of Object.values(cptNorms.CPT_NORMS)) assert.equal(Object.keys(norm).length, 10)
assert.deepEqual(json(cptNorms.CPT_NORMS[5].omission), { mean: 22.74, sd: 16.45 })
assert.deepEqual(json(cptNorms.CPT_NORMS[8].rt), { mean: 598.74, sd: 66.2 })
assert.deepEqual(json(cptNorms.CPT_NORMS[11].rt), { mean: 418.68, sd: 52.43 }) // as published
assert.deepEqual(json(cptNorms.CPT_NORMS[12].dPrime), { mean: 5, sd: .31 })
// The earlier reference norms (hit/omission/commission) are the same published values.
for (const age of [5, 6, 7, 8, 9, 10, 11, 12]) for (const key of ['hit', 'omission', 'commission']) assert.deepEqual(json(cptNorms.CPT_NORMS[age][key]), json(cptReference.api.norms[age][key]))
for (let seed = 1; seed <= 1000; seed++) {
  cpt.sandbox.Math.random = random(seed); cptReference.Math.random = random(seed)
  for (const [total, targets] of [[10, 3], [100, 20], [400, 80]]) {
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
]) {
  // The original metrics are unchanged; the Kanaka parameters are added alongside.
  const original = originalMetrics(trials), metrics = json(cpt.exports.summarizeTrials(trials))
  assert.deepEqual(Object.fromEntries(Object.keys(original).map(key => [key, metrics[key]])), json(original))
}
{
  // 80 targets / 320 non-targets: 40 hits, 1 T-cancel, 39 omissions, 80 commissions, 2 N-cancels.
  const many = (n, make) => Array.from({ length: n }, make)
  const trials = [...many(40, () => trial(true, 300)), { ...trial(true, 90), hit: false, anticipatory: true }, ...many(39, () => trial(true, null, true)),
    ...many(80, () => trial(false, 400)), ...many(2, () => ({ ...trial(false, 80), commission: false, anticipatory: true })), ...many(238, () => trial(false, null))]
  const m = cpt.exports.summarizeTrials(trials)
  assert.equal(m.hitRate, .5); assert.equal(m.omissionCount, 39); assert.equal(m.commissionCount, 80)
  assert.equal(m.targetCancelCount, 1); assert.equal(m.nonTargetCancelCount, 2)
  assert.equal(m.falseAlarmRate, 82 / 320); assert.equal(m.cvrt, 0)
  const zf = cpt.exports.inverseNormal(82 / 320)
  assert.ok(Math.abs(m.dPrime - (0 - zf)) < 1e-12); assert.ok(Math.abs(m.lnBeta - zf ** 2 / 2) < 1e-12)
  assert.ok(Math.abs(cpt.exports.inverseNormal(.975) - 1.959963985) < 1e-8)
  // Perfect rates use the 1/(2N) correction, so d′ stays finite.
  const perfect = cpt.exports.summarizeTrials([...many(80, () => trial(true, 400)), ...many(320, () => trial(false, null))])
  assert.ok(Math.abs(perfect.dPrime - (cpt.exports.inverseNormal(1 - 1 / 160) - cpt.exports.inverseNormal(1 / 640))) < 1e-12)
  assert.equal(cpt.exports.summarizeTrials([trial(true, 300), trial(true, 500)]).cvrt, 100 / 400 * 100)
}
assert.equal(cpt.exports.summarizeTrials([trial(true,100),trial(true,300),trial(false,null)]).reactionTimeSD, 100)
console.log('PASS CPT: 1000 seeded HTML-equivalent sequences (10/100/400), adjacency, timing, Kanaka 2008 norms, metrics, T/N-cancel, False, CVRT, d′, lnβ, zero-hit case')

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
for (let i = 1; i <= 400; i++) {
  assert.equal(frame.index, i); assert.equal(frame.total, 400)
  const shouldRespond = frame.stimulus === 7 ? (++hitIndex % 2 === 0) : (++nonTargetIndex % 4 === 0)
  if (shouldRespond) { time.elapse(300.4); session.respond(); time.elapse(20); session.respond(); assert.equal(frame.index, i) }
  time.next()
}
assert.equal(completed.trials.length, 400)
assert.equal(completed.metrics.hitRate, .5)
assert.equal(completed.metrics.omissionCount, 40)
assert.equal(completed.metrics.commissionCount, 80)
assert.equal(completed.metrics.meanReactionTime, 300)
assert.equal(completed.metrics.reactionTimeSD, 0)
assert.equal(completed.durationMs, completed.testFinishedAt - completed.testStartedAt)
assert.equal(feedbackCount, 10) // practice only
assert.equal(time.pending.size, 0)
session.beginPractice(); session.reset(); assert.equal(time.pending.size, 0)
{
  // A press within 150 ms is anticipatory: neither hit nor commission, and not an omission.
  const quick = new runtime.exports.CptSession({ onTrial: v => { frame = v }, onFeedback: () => {}, onPracticeComplete: () => {}, onTestComplete: r => completed = r }, { testTrials: 20 })
  quick.beginTest(); time.elapse(149); quick.respond(); const first = frame.stimulus
  for (let i = 1; i <= 20; i++) time.next()
  const t = completed.trials[0]
  assert.equal(t.anticipatory, true); assert.equal(t.hit || t.commission || t.omission, false)
  assert.equal(first === 7 ? completed.metrics.targetCancelCount : completed.metrics.nonTargetCancelCount, 1)
}
console.log('PASS CPT controller: 10+400 trials (Kanaka 2008), 150 ms anticipatory responses, no response-driven advancement, first response, RT rounding, counts, feedback, cleanup')

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
