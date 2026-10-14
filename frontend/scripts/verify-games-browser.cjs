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
})();`

async function main() {
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
    const clickWord = word => evaluate(`(()=>{const b=[...document.querySelectorAll('.word')].find(b=>[...b.childNodes].some(n=>n.nodeType===3&&n.textContent===${JSON.stringify(word)}));if(!b||b.disabled)throw Error('word disabled');b.click()})()`)
    const tick = async () => { const delay=await evaluate('window.__gameClock.next()');await pause(10);return delay }
    const navigate = async route => { await send('Page.navigate',{url:'http://127.0.0.1:4175'+route});await until(()=>evaluate('Boolean(document.querySelector("#root")?.children.length)'),route) }
    await send('Runtime.enable'); await send('Page.enable')
    await send('Page.addScriptToEvaluateOnNewDocument',{source:clockScript})
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
    await navigate('/iep')
    await click('二、學生能力現況評量紀錄'); await click('EyeEP 遊戲評量')
    await waitText('Monkey Game')
    assert.equal(await evaluate('location.pathname'),'/iep/game-assessment')
    assert.equal(await evaluate('document.querySelectorAll(".game-selection-card").length'),2)
    await evaluate('document.querySelector(\'a[href="/iep/game-assessment/monkey"]\').click()')
    await waitText('猴子工作記憶遊戲'); await click('開始遊戲'); await click('6歲')
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
    assert.ok((await text()).includes('80 / 80 個位置'))
    assert.equal(await evaluate('document.querySelector(".score-box strong").textContent'),'100%')
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".levels b")].map(b=>b.textContent)'),Array(5).fill('100%'))
    assert.ok((await text()).includes('3.88 SD'));assert.ok((await text()).includes('明顯高於同齡研究平均'))
    await click('再玩一次');await waitText('猴子工作記憶遊戲')
    await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
    console.log('PASS Browser Monkey: React Router, 4 practice + 20 test, reverse/order, undo/confirm, full speech/timing, score/norm/result/restart/return')

    await evaluate('document.querySelector(\'a[href="/iep/game-assessment/cpt"]\').click()');await waitText('數字注意力挑戰');await click('開始練習')
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
    for(let i=1;i<=100;i++){
      await waitText(`第 ${i} / 100 題`)
      const stimulus=await evaluate('Number(document.querySelector(".stimulus").textContent)');stimuli.push(stimulus)
      const respond=stimulus===7?(++targets%2===0):(++nonTargets%4===0)
      await space(true) // repeated keydown must not respond, even before first reaction
      if(respond){
        await evaluate('window.__gameClock.elapse(123.4)')
        if(i%2) await space(false);else await click('按下！也可按 Space')
        await evaluate('window.__gameClock.elapse(50)');await space(false)
        await waitText(`第 ${i} / 100 題`)
      }
      assert.equal(await evaluate('document.querySelector(".practice-feedback").textContent'),'')
      const delay=await tick();assert.ok(delay>=1000&&delay<=2000)
    }
    assert.equal(targets,20);assert.equal(nonTargets,80)
    assert.ok(stimuli.every((n,i)=>n!==stimuli[i-1]))
    await waitText('持續注意力測驗結果')
    const metrics=await evaluate('Object.fromEntries([...document.querySelectorAll(".metric")].map(d=>[d.querySelector("span").textContent,d.querySelector("strong").textContent]))')
    assert.deepEqual({...metrics,'測驗時間':undefined},{命中率:'50%',漏答:'10 次',漏答率:'50.0%',誤按:'20 次',誤按率:'25.0%',平均反應時間:'123 ms','反應時間 SD':'0 ms','測驗時間':undefined})
    assert.ok((await text()).includes('8 歲・共 100 題'));assert.ok((await text()).includes('Z-score'))
    await click('再玩一次');await waitText('數字注意力挑戰')
    await click('開始練習');await waitText('第 1 / 10 題');await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
    assert.equal(await evaluate('window.__gameClock.pending.size'),0)
    await click('← 返回 IEP 評量紀錄');await waitText('（一）評量資料與紀錄')
    assert.equal(await evaluate('document.querySelectorAll(".assessment-table-row").length'),6)
    assert.equal(await evaluate('localStorage.length'),0)
    console.log('PASS Browser CPT: 10+100, target counts/adjacency, Button/Space/repeat/first response, 1000–2000ms, RT, all metrics, age/result/restart/return/cleanup; no IEP writes')

    // Direct-entry routes, mobile layout, zero-hit results, and a fresh Monkey restart.
    await navigate('/iep/game-assessment/cpt');await waitText('數字注意力挑戰')
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'))
    await click('開始練習');for(let i=0;i<10;i++)await tick()
    await click('選擇年齡並開始');await click('12 歲');await click('開始正式測驗');for(let i=0;i<100;i++)await tick()
    await waitText('持續注意力測驗結果')
    assert.ok((await text()).includes('無 Hit'));assert.ok((await text()).includes('沒有正確 Hit，無法計算。'))
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'))
    await navigate('/iep/game-assessment/monkey');await waitText('猴子工作記憶遊戲')
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'))
    await click('開始遊戲');await click('12歲');await waitText('練習題 1 / 4')
    await click('← 返回遊戲選擇頁');await waitText('Monkey Game')
    assert.equal(await evaluate('window.__gameClock.pending.size'),0)
    assert.deepEqual(errors,[])
    console.log('PASS Browser: direct routes, mobile width 390, zero-hit CPT, no runtime/console errors')
  } finally {
    socket?.close();browser?.kill();server.kill()
    // The dedicated temporary Chrome profile is deliberately retained under node_modules/.cache.
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
