// Unit-level lifecycle checks: no browser, physical camera, or permissions used.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const root = path.resolve(__dirname,'..')
const compile = filename => ts.transpileModule(fs.readFileSync(path.join(root,filename),'utf8').replaceAll('import.meta.env.BASE_URL',"'/'"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
const deferred = () => { let resolve;const promise = new Promise(r=>resolve=r);return {promise,resolve} }

function setup() {
  const request = deferred(), playback = deferred(), refs = [], updates = [], pending = new Map()
  let id=0, stops=0, workers=0, stateIndex=0
  const logic = { exports: {}, structuredClone }
  vm.runInNewContext(compile('src/components/games/attention/attentionLogic.ts'),logic)
  const react = {
    useRef: value => { const ref={current:value};refs.push(ref);return ref },
    useState: initial => { const index=stateIndex++;return [initial,value=>updates.push({index,value})] },
    useCallback: fn => fn,
    useEffect: fn => fn(),
  }
  const context = { exports:{}, structuredClone, URL,
    require: name => name==='react'?react:logic.exports,
    window:{isSecureContext:true}, navigator:{mediaDevices:{getUserMedia:()=>request.promise}},
    document:{addEventListener(){},removeEventListener(){}},
    location:{origin:'http://localhost:5173'}, performance:{now:()=>1000},
    setTimeout: (fn,delay)=>{pending.set(++id,{fn,delay});return id}, clearTimeout:key=>pending.delete(key),
    Worker: class { constructor(){workers++;throw Error('Unexpected worker startup')} },
  }
  vm.runInNewContext(compile('src/components/games/attention/useAttentionTracker.ts'),context)
  const tracker = context.exports.useAttentionTracker()
  const track={onended:null,stop:()=>stops++}
  const camera={getTracks:()=>[track],getVideoTracks:()=>[track]}
  const fire = delay => { const [key,timer]=[...pending].find(([,value])=>value.delay===delay)||[];assert.ok(timer,`timer ${delay}`);pending.delete(key);timer.fn() }
  refs[0].current={srcObject:null,play:()=>playback.promise}
  return { tracker,request,playback,camera,pending,updates,fire,stops:()=>stops,workers:()=>workers }
}

async function main() {
  {
    const t=setup(), start=t.tracker.start()
    t.fire(20000)
    assert.ok(t.updates.some(s=>s.value==='error'))
    assert.ok(t.updates.some(s=>typeof s.value==='string'&&s.value.includes('等待攝影機逾時')))
    t.request.resolve(t.camera);await start
    assert.equal(t.stops(),1);assert.equal(t.workers(),0);assert.equal(t.pending.size,0)
  }
  {
    const t=setup(),start=t.tracker.start()
    t.tracker.stop();t.request.resolve(t.camera);await start
    assert.equal(t.stops(),1);assert.equal(t.workers(),0);assert.equal(t.pending.size,0)
  }
  {
    const t=setup(),start=t.tracker.start()
    t.request.resolve(t.camera);await new Promise(resolve=>setImmediate(resolve))
    t.fire(15000)
    assert.ok(t.updates.some(s=>typeof s.value==='string'&&s.value.includes('沒有提供可播放的畫面')))
    assert.equal(t.stops(),1)
    t.playback.resolve();await start
    assert.equal(t.workers(),0);assert.equal(t.pending.size,0)
  }
  console.log('PASS pending camera permission timeout, late stream release, cancellation, video playback timeout, no stale worker or timers')
}
main().catch(error=>{console.error(error);process.exitCode=1})
