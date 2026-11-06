/* Native Chrome/CDP integration checks. Requires Chrome and Node 22+.
   Run from frontend: node scripts/verify-games-browser.cjs
   Only this test page receives the controlled clock and speech mock. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn, label) {
  for (let i = 0; i < 300; i++) { const value = await fn(); if (value) return value; await pause(20) }
  throw new Error(`Timed out: ${label}`)
}
const clockScript = `(() => {
  const originalSet = window.setTimeout.bind(window), originalClear = window.clearTimeout.bind(window);
  let now = 10000, key = 1000000;
  const pending = new Map(), delays = [], spoken = [];
  window.setTimeout = (fn, delay, ...args) => {
    if ([200,240,450,500,650].includes(delay) || (delay >= 1000 && delay <= 2000)) {
      const id = ++key; delays.push(delay); pending.set(id,{fn:()=>fn(...args),delay,due:now+delay}); return id;
    }
    return originalSet(fn,delay,...args);
  };
  window.clearTimeout = id => { pending.delete(id); originalClear(id) };
  Object.defineProperty(performance,'now',{value:()=>now});
  Date.now = ()=>now;
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    speak: u => spoken.push(u), cancel: () => {}
  }});
  window.__gameClock = {
    pending, delays, spoken,
    elapse(ms){now+=ms},
    next(){const [id,t]=[...pending].sort((a,b)=>a[1].due-b[1].due)[0]||[]; if(!t)throw Error('No pending timer'); pending.delete(id);now=t.due;t.fn();return t.delay},
    endSpeech(){const u=spoken.at(-1);if(!u)throw Error('No speech');u.onend()},
  };
  // Keep the checks offline and deterministic: the game comments fall back to the rule-based text.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => ['/api/cpt-comment','/api/monkey-comment'].some(path => String(input).includes(path)) ? Promise.reject(new Error('offline')) : originalFetch(input, init);
})();`

async function main() {
  const attentionChecks = process.argv.includes('--attention')
  const watchdog = setTimeout(() => { console.error('Browser checks timed out'); process.exit(1) }, 480000)
  const cache = path.join(root, 'node_modules/.cache')
  fs.mkdirSync(cache, { recursive: true })
  const profile = fs.mkdtempSync(path.join(cache, 'eyeep-browser-'))
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: root, stdio: 'pipe' })
  let output = ''
  server.stdout.on('data', data => output += data)
  server.stderr.on('data', data => output += data)
  let browser, socket
  try {
    await until(async () => { if (server.exitCode !== null) throw new Error(output); try { return (await fetch('http://127.0.0.1:4175')).ok } catch { return false } }, 'Vite server')
    browser = spawn(chromePath, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' })
    browser.on('error', error => console.error(error))
    const portFile = path.join(profile, 'DevToolsActivePort')
    await until(() => fs.existsSync(portFile), 'Chrome DevTools')
    const port = fs.readFileSync(portFile,'utf8').split('\n')[0]
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve,reject) => { socket.onopen=resolve;socket.onerror=reject })
    let seq = 0
    const pending = new Map(), errors = []
    socket.onmessage = event => {
      const message = JSON.parse(event.data)
      if (message.id) { const waiter = pending.get(message.id); pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result) }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.value ?? a.description))
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params})) })
    const evaluate = async expression => {
      const value = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
      if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails))
      return value.result.value
    }
    const text = () => evaluate('document.body.innerText')
    const waitText = value => until(async () => (await text()).includes(value), value)
    const click = async label => { await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Missing/enabled control: '+${JSON.stringify(label)});b.click()})()`); await pause(10) }
    // The camera summary shows key figures; phases and all counts sit in 詳細資料.
    const openAttentionDetails = () => evaluate('document.querySelector(".attention-details").open = true')
    const zeroClassesHidden = () => evaluate('[...document.querySelectorAll(".attention-lines dd")].every(d => !/(^|、)\\S+ 0 次/.test(d.textContent))')
    const clickWord = word => evaluate(`(()=>{const b=[...document.querySelectorAll('.word')].find(b=>[...b.childNodes].some(n=>n.nodeType===3&&n.textContent===${JSON.stringify(word)}));if(!b||b.disabled)throw Error('word disabled');b.click()})()`)
    const tick = async () => { const delay=await evaluate('window.__gameClock.next()');await pause(10);return delay }
    const navigate = async route => { await send('Page.navigate',{url:'http://127.0.0.1:4175'+route});await until(()=>evaluate('Boolean(document.querySelector("#root")?.children.length)'),route) }
    await send('Runtime.enable'); await send('Page.enable')
    await send('Page.addScriptToEvaluateOnNewDocument',{source:clockScript})
    const checkRealModel = async (emotionOnly = false) => {
      if (!emotionOnly) {
      const sample = await evaluate(`new Promise((resolve,reject)=>{
        const w=new (window.__NativeWorker||window.Worker)('/vision/attention-worker.js');let stage='starting';
        const timeout=setTimeout(()=>{w.terminate();reject(Error('Real model timeout: '+stage))},30000);
        w.onerror=e=>{clearTimeout(timeout);w.terminate();reject(Error(e.message))};
        w.onmessage=async({data})=>{
          if(data.type==='loading'){stage=data.stage;return}
          if(data.type==='ready'){try{if(!data.prototypesAvailable)throw Error('Trained classifiers unavailable: '+stage);stage='inference';const c=new OffscreenCanvas(320,240);c.getContext('2d').fillRect(0,0,320,240);const b=await createImageBitmap(c);w.postMessage({type:'frame',bitmap:b,timestamp:1000},[b])}catch(error){clearTimeout(timeout);w.terminate();reject(error)}}
          else{clearTimeout(timeout);w.terminate();data.type==='error'?reject(Error(data.message)):resolve(data)}
        };
        w.postMessage({type:'init',assetRoot:location.origin+'/vision/'});
      })`)
      assert.equal(sample.type,'sample');assert.equal(sample.faces,0);assert.equal(sample.yaw,null)
      }
      const parity = await evaluate(`new Promise((resolve,reject)=>{
        const source=\`self.onmessage=async({data})=>{try{importScripts(data.root+'tf.min.js',data.root+'prototype-inference.js');await self.EyeEPPrototypes.load(data.root,data.names);postMessage(await self.EyeEPPrototypes.parity(data.root))}catch(e){postMessage({error:String(e)})}}\`;
        const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
        const worker=new (window.__NativeWorker||window.Worker)(url);
        const timeout=setTimeout(()=>{worker.terminate();URL.revokeObjectURL(url);reject(Error('Parity timeout'))},30000);
        worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();URL.revokeObjectURL(url);data.error?reject(Error(data.error)):resolve(data)};
        worker.postMessage({root:location.origin+'/vision/',names:['emotion']});
      })`)
      assert.ok(parity.emotion.maxError < 1e-4,JSON.stringify(parity.emotion))
      console.log('PASS Python/browser classifier parity: '+JSON.stringify({emotion:parity.emotion.maxError}))
    }
    if (process.argv.includes('--model-only') || process.argv.includes('--emotion-only')) {
      await navigate('/iep/game-assessment')
      await checkRealModel(process.argv.includes('--emotion-only'))
      console.log('PASS real local model/WASM worker inference')
      return
    }
    if (attentionChecks) await send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(__dirname,'attention-browser-fixture.js'),'utf8')})
    const calibrateCamera = async () => {
      const before = await evaluate('window.__cameraSamples')
      await click('開啟偵測'); await waitText('校準正面朝向')
      await click('校準正面朝向')
      await until(()=>evaluate(`window.__cameraSamples >= ${before + 10}`),'calibration samples')
      await evaluate('window.__gameClock.elapse(3000)')
      await waitText('校準完成')
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
    if (attentionChecks) await navigate('/iep/game-assessment')
    else { await navigate('/iep'); await click('二、學生能力現況評量紀錄'); await click('EyeEP 遊戲評量') }
    await waitText('Monkey Game')
    assert.equal(await evaluate('location.pathname'),'/iep/game-assessment')
    assert.equal(await evaluate('document.querySelectorAll(".game-selection-card:not(.game-demo-card)").length'),2)
    assert.equal(await evaluate('document.querySelectorAll(".game-demo-card").length'),2) // 展示版 section below
    await evaluate('document.querySelector(\'a[href="/iep/game-assessment/monkey"]\').click()')
    await waitText('猴子工作記憶遊戲')
    if (attentionChecks) {
      assert.equal(await evaluate('window.__cameraRequests'),0)
      await evaluate('window.__denyCamera=true'); await click('開啟偵測'); await waitText('攝影機權限未開啟')
      await evaluate('window.__denyCamera=false'); await click('重試開啟偵測'); await waitText('校準正面朝向'); await click('關閉偵測')
      await calibrateCamera()
    }
    await click('開始遊戲'); await click('一年級')
    for (let i=0;i<4;i++) {
      await waitText(`練習題 ${i+1} / 4`)
      const sequence=await evaluate('[...document.querySelectorAll(".sequence span")].map(s=>s.textContent)')
      assert.equal(sequence.length,i<2?2:3)
      const answer=i<2?sequence:[...sequence].reverse()
      if (i===0) { await clickWord(answer[0]);await click('上一步');assert.ok((await text()).includes('尚未選擇答案')) }
      for (const word of answer) { await clickWord(word);await pause(5) }
      assert.equal(await evaluate('Boolean(document.querySelector(".feedback"))'),false)
      await click('確認答案'); await waitText('答對了！做得好！')
      assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="上一步").disabled'),true)
      await click(i===3?'開始正式測驗':'下一題')
    }
    for (let i=0;i<20;i++) {
      const level=Math.floor(i/4)+1, count=level+1
      await waitText(`第 ${i+1} / 20 題`)
      assert.ok((await text()).includes(`Level ${level}`))
      assert.equal(await evaluate('document.querySelectorAll(".word").length'),0)
      const start=await evaluate('window.__gameClock.spoken.length')
      assert.equal(await tick(),450)
      for (let word=0;word<count;word++) {
        const u=await evaluate('(()=>{const u=window.__gameClock.spoken.at(-1);return {lang:u.lang,rate:u.rate}})()')
        assert.equal(u.lang,'zh-TW');assert.ok(Math.abs(u.rate-.78)<1e-6)
        await evaluate('window.__gameClock.endSpeech()');assert.equal(await tick(),650)
      }
      assert.equal(await tick(),500)
      await waitText('請用相反順序點選')
      const sequence=await evaluate(`window.__gameClock.spoken.slice(${start}).map(u=>u.text)`)
      assert.equal(sequence.length,count)
      const answer=[...sequence].reverse()
      if(i===0){await clickWord(answer[0]);await click('上一步');assert.ok((await text()).includes('尚未選擇答案'))}
      for(const word of answer){await clickWord(word);await pause(5)}
      assert.ok((await text()).includes(`第 ${i+1} / 20 題`))
      await click('確認答案')
      assert.ok(await evaluate('[...document.querySelectorAll(".monkey-game .card button")].every(b=>b.disabled)'))
      assert.equal(await tick(),240)
    }
    await waitText('完成測驗！')
    if (attentionChecks) {
      await waitText('攝影機觀察'); assert.ok((await text()).includes('表情 · 研究原型')); assert.ok(await zeroClassesHidden())
      await openAttentionDetails(); assert.ok((await text()).includes('聆聽詞語')); assert.ok((await text()).includes('記憶作答'))
      assert.equal(await evaluate('window.__cameraStreams.every(s=>s.getTracks().every(t=>t.readyState==="ended"))'),true)
    }
    assert.ok((await text()).includes('80 / 80 個位置'))
    // Grade-based norms (Van de Weijer-Bergsma et al., 2016): all correct in Grade 1 is (1 − .38) / .16 = 3.88 SD.
    assert.equal(await evaluate('document.querySelector(".cpt-report-tile strong").textContent'),'100.0%')
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".monkey-level-row .cpt-report-value")].map(b=>b.textContent)'),Array(5).fill('100%'))
    assert.ok((await evaluate('document.querySelector(".cpt-report-details").textContent')).includes('3.88'));assert.ok((await text()).includes('優於同齡'));assert.ok((await text()).includes('Van de Weijer-Bergsma'))
    await waitText('與國小一年級研究樣本相比')
    await click('再玩一次');await waitText('猴子工作記憶遊戲')
    await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
    console.log('PASS Browser Monkey: React Router, 4 practice + 20 test, reverse/order, undo/confirm, full speech/timing, score/norm/result/restart/return')

    await evaluate('document.querySelector(\'a[href="/iep/game-assessment/cpt"]\').click()');await waitText('數字注意力挑戰')
    if (attentionChecks) await calibrateCamera()
    await click('開始練習')
    const practice=[]
    for(let i=1;i<=10;i++){
      await waitText(`第 ${i} / 10 題`)
      practice.push(await evaluate('Number(document.querySelector(".stimulus").textContent)'))
      const delay=await tick();assert.ok(delay>=1000&&delay<=2000)
    }
    assert.equal(practice.filter(n=>n===7).length,3)
    await waitText('練習完成，準備開始正式測驗');await click('選擇年齡並開始')
    assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="開始正式測驗").disabled'),true)
    await click('8 歲');await click('開始正式測驗')
    const stimuli=[];let targets=0,nonTargets=0
    const space=repeat=>evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',repeat:${repeat},bubbles:true,cancelable:true}))`)
    for(let i=1;i<=400;i++){
      await waitText(`第 ${i} / 400 題`)
      if (attentionChecks && i===1) {
        // Only the camera picture stays beside the game during the test, still
        // showing the same stream, with no buttons the child's Space could press;
        // the face is outlined and labelled with its live expression.
        assert.equal(await evaluate('getComputedStyle(document.querySelector(".attention-monitor")).position'),'fixed')
        assert.equal(await evaluate('document.querySelector(".attention-monitor video").hidden'),false)
        assert.equal(await evaluate('document.querySelector(".attention-monitor video").srcObject?.active'),true)
        assert.equal(await evaluate('document.querySelectorAll(".attention-monitor button").length'),0)
        await until(()=>evaluate('document.querySelectorAll(".attention-monitor .attention-face").length===1'),'face outline')
        await until(()=>evaluate('document.querySelector(".attention-monitor").innerText.trim()==="開心"'),'live expression label').catch(async error => { console.log('DEBUG monitor', await evaluate('document.querySelector(".attention-monitor").innerHTML')); throw error })
        // The preview is mirrored, so a face at x 35–65% of the frame is outlined at 35–65% from the right.
        assert.equal(await evaluate('document.querySelector(".attention-face").style.left'),'35%')
        const captures = path.join(cache,'attention-screenshots');fs.mkdirSync(captures,{recursive:true})
        const monitor = await send('Page.captureScreenshot',{format:'png'})
        fs.writeFileSync(path.join(captures,'cpt-monitor-desktop.png'),Buffer.from(monitor.data,'base64'))
      }
      const stimulus=await evaluate('Number(document.querySelector(".stimulus").textContent)');stimuli.push(stimulus)
      const respond=stimulus===7?(++targets%2===0):(++nonTargets%4===0)
      // The first target is pressed within 150 ms: a T-cancel, neither hit nor omission.
      const anticipate=stimulus===7&&targets===1
      await space(true) // repeated keydown must not respond, even before first reaction
      if(anticipate){await evaluate('window.__gameClock.elapse(100)');await space(false)}
      if(respond){
        await evaluate('window.__gameClock.elapse(323.4)')
        if(i%2) await space(false);else await click('按下！也可按 Space')
        await evaluate('window.__gameClock.elapse(50)');await space(false)
        await waitText(`第 ${i} / 400 題`)
      }
      assert.equal(await evaluate('document.querySelector(".practice-feedback").textContent'),'')
      const delay=await tick();assert.ok(delay>=1000&&delay<=2000)
    }
    assert.equal(targets,80);assert.equal(nonTargets,320)
    assert.ok(stimuli.every((n,i)=>n!==stimuli[i-1]))
    await waitText('持續注意力測驗結果')
    if (attentionChecks) {
      await waitText('攝影機觀察'); assert.ok((await text()).includes('表情 · 研究原型')); assert.ok(await zeroClassesHidden())
      await openAttentionDetails(); assert.ok((await text()).includes('數字作答'))
      assert.equal(await evaluate('window.__cameraStreams.every(s=>s.getTracks().every(t=>t.readyState==="ended"))'),true)
    }
    // Kanaka et al. (2008) parameters against the 8-year-old reference.
    const table=await evaluate('Object.fromEntries([...document.querySelectorAll(".cpt-norm-table tbody tr")].map(r=>[r.querySelector("th").firstChild.textContent,[...r.querySelectorAll("td")].map(td=>td.textContent)]))')
    assert.deepEqual(Object.fromEntries(Object.entries(table).map(([k,v])=>[k,v[0]])),{'命中率（Hit）':'50.0%','漏答（Omission）':'39 次','誤按（Commission）':'80 次','搶先按 7（T-cancel）':'1 次','搶先按其他數字（N-cancel）':'0 次','錯誤警報率（False）':'25.00%','平均反應時間（RT）':'323 ms','反應穩定度（CVRT）':'0.0%','辨別力（d′）':'0.67','作答傾向（lnβ）':'0.23'})
    assert.deepEqual(table['命中率（Hit）'].slice(1),['98.0%（SD 3.0%）','-16.00','明顯需留意'])
    assert.deepEqual(table['平均反應時間（RT）'].slice(1),['599 ms（SD 66.2）','-4.17','優於同齡'])
    assert.equal(table['錯誤警報率（False）'][3],'僅供對照')
    assert.ok((await text()).includes('8 歲・共 400 題'));assert.ok((await text()).includes('Kanaka'))
    await waitText('評語');assert.ok((await text()).includes('與 8 歲研究樣本相比'))
    assert.ok((await text()).includes('與 8 歲同齡孩子比較'));assert.equal(await evaluate('document.querySelectorAll(\'.cpt-report-group\').length'),4)
    await click('再玩一次');await waitText('數字注意力挑戰')
    await click('開始練習');await waitText('第 1 / 10 題');await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
    assert.equal(await evaluate('window.__gameClock.pending.size'),0)
    await click('← 返回 IEP 評量紀錄');await waitText('（一）評量資料與紀錄')
    if (!attentionChecks) assert.equal(await evaluate('document.querySelectorAll(".assessment-table-row").length'),6)
    assert.equal(await evaluate('localStorage.length'),0)
    console.log('PASS Browser CPT: 10+400 (Kanaka 2008), T-cancel, norm table, rule-based comment, target counts/adjacency, Button/Space/repeat/first response, 1000–2000ms, RT, all metrics, age/result/restart/return/cleanup; no IEP writes')

    // Direct-entry routes, mobile layout, zero-hit results, and a fresh Monkey restart.
    await navigate('/iep/game-assessment/cpt');await waitText('數字注意力挑戰')
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'))
    await click('開始練習');for(let i=0;i<10;i++)await tick()
    await click('選擇年齡並開始');await click('12 歲');await click('開始正式測驗');for(let i=0;i<400;i++)await tick()
    await waitText('持續注意力測驗結果')
    assert.ok((await text()).includes('本次沒有正確命中，無法計算反應時間與變異係數。'))
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'))
    await navigate('/iep/game-assessment/monkey');await waitText('猴子工作記憶遊戲')
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'))
    await click('開始遊戲');await click('六年級');await waitText('練習題 1 / 4')
    await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
    assert.equal(await evaluate('window.__gameClock.pending.size'),0)
    assert.deepEqual(errors,[])
    console.log('PASS Browser: direct routes, mobile width 390, zero-hit CPT, no runtime/console errors')
    if (attentionChecks) {
      const captures = path.join(cache,'attention-screenshots');fs.mkdirSync(captures,{recursive:true})
      for (const game of ['monkey','cpt']) {
        await navigate(`/iep/game-assessment/${game}`);await waitText('開啟偵測')
        await calibrateCamera()
        const mobile = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
        fs.writeFileSync(path.join(captures,`${game}-mobile.png`),Buffer.from(mobile.data,'base64'))
        await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
        const desktop = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
        fs.writeFileSync(path.join(captures,`${game}-desktop.png`),Buffer.from(desktop.data,'base64'))
        await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
        assert.equal(await evaluate('window.__cameraStreams.every(s=>s.getTracks().every(t=>t.readyState==="ended"))'),true)
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
      }
      // Run the real, local model/WASM in the real classic worker. Blank input
      // validates assets + inference plumbing, not accuracy on real children.
      await checkRealModel()
      console.log('PASS camera: opt-in/denial/retry/calibration, both formal reports, finish/route cleanup, real local model + blank-frame inference; screenshots: '+captures)
    }
  } finally {
    clearTimeout(watchdog)
    socket?.close();browser?.kill();server.kill()
    // The dedicated temporary Chrome profile is deliberately retained under node_modules/.cache.
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
