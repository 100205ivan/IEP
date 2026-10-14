/* Real PDF.js + real Tesseract.js integration, no mocked OCR results.
   Run: node scripts/verify-assessment-documents-browser.cjs
   Requires Node 22+ and Chrome (override CHROME_PATH on other systems). */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const cache = path.join(root, 'node_modules/.cache')
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn, label, timeout = 30000) {
  const started = Date.now()
  while(Date.now()-started<timeout){const value=await fn();if(value)return value;await pause(50)}
  throw Error(`Timed out: ${label}`)
}
function pdf(objects) {
  const parts=[Buffer.from('%PDF-1.7\n')], offsets=[0]
  objects.forEach((object,index)=>{offsets.push(parts.reduce((n,b)=>n+b.length,0));parts.push(Buffer.from(`${index+1} 0 obj\n`),Buffer.isBuffer(object)?object:Buffer.from(object),Buffer.from('\nendobj\n'))})
  const start=parts.reduce((n,b)=>n+b.length,0)
  parts.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`))
  return Buffer.concat(parts)
}
function stream(dictionary,bytes){return Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`),bytes,Buffer.from('\nendstream')])}
function textPdf(pageLines){
  const toUnicode=Buffer.from('/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange 1 beginbfrange <0000> <FFFF> <0000> endbfrange endcmap CMapName currentdict /CMap defineresource pop end end')
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type0 /BaseFont /MSung-Light /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 5 0 R >>','<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MSung-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 0 >> /DW 1000 >>',stream('',toUnicode)]
  const kids=[]
  for(const lines of pageLines){
    const id=objects.length+1;kids.push(`${id} 0 R`)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`)
    const contents=lines.map((line,i)=>{const hex=Buffer.from(line,'utf16le').swap16().toString('hex');return `BT /F1 12 Tf 1 0 0 1 30 ${760-i*30} Tm <${hex}> Tj ET`}).join('\n')
    objects.push(stream('',Buffer.from(contents)))
  }
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`
  return pdf(objects)
}
function scanPdf(jpegs){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',''],kids=[]
  for(const jpeg of jpegs){
    const id=objects.length+1;kids.push(`${id} 0 R`)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im1 ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`)
    objects.push(stream('',Buffer.from('q 600 0 0 800 0 0 cm /Im1 Do Q')))
    objects.push(stream('/Type /XObject /Subtype /Image /Width 1200 /Height 1600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',Buffer.from(jpeg,'base64')))
  }
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`
  return pdf(objects)
}
async function main(){
  fs.mkdirSync(cache,{recursive:true})
  const directory=fs.mkdtempSync(path.join(cache,'eyeep-document-tests-'))
  const profile=path.join(directory,'chrome')
  const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','4176','--strictPort'],{cwd:root,stdio:'pipe'})
  let serverOutput='';server.stdout.on('data',d=>serverOutput+=d);server.stderr.on('data',d=>serverOutput+=d)
  let browser,socket
  try{
    await until(async()=>{if(server.exitCode!==null)throw Error(serverOutput);try{return(await fetch('http://127.0.0.1:4176')).ok}catch{return false}},'Vite')
    browser=spawn(chromePath,['--headless=new','--disable-extensions','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
    browser.on('error',e=>console.error(e))
    await until(()=>fs.existsSync(path.join(profile,'DevToolsActivePort')),'Chrome')
    const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]
    const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
    let seq=0,blockOcr=false;const waiting=new Map(),requests=[],exceptions=[]
    socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const w=waiting.get(m.id);waiting.delete(m.id);m.error?w.reject(Error(JSON.stringify(m.error))):w.resolve(m.result)}if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);if(m.method==='Target.attachedToTarget'){const sessionId=m.params.sessionId;void(async()=>{await send('Network.enable',{},sessionId);await send('Network.setBlockedURLs',{urls:blockOcr?['*ocr/core/*']:[]},sessionId);await send('Runtime.runIfWaitingForDebugger',{},sessionId)})().catch(error=>exceptions.push(String(error)))}}
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))})
    const evaluate=async expression=>{const v=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value}
    const text=()=>evaluate('document.body?.innerText ?? \'\'')
    const waitText=(value,timeout)=>until(async()=>(await text()).includes(value),value,timeout)
    const click=async label=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Missing/enabled: '+${JSON.stringify(label)});b.click()})()`);await pause(20)}
    const upload=async file=>{const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'input[type=file]'});await send('DOM.setFileInputFiles',{nodeId,files:[file]})}
    const open=()=>click('AI 辨識評估文件')
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable')
    await send('Page.navigate',{url:'http://127.0.0.1:4176/iep?subTab=ability-record'});await waitText('（一）評量資料與紀錄')
    const lines=['綜合評估報告','學生姓名：王小明','身分證字號：A123456789','出生日期：2015/03/02','電話：0912-345-678','住址：高雄市苓雅區和平一路123號','家長姓名：林美華','學校名稱：高雄市快樂國民小學','醫師姓名：陳大文','醫療院所：高雄市仁愛醫院','精細動作與語言理解需要持續支持。','Fine motor and language assessment.']
    const textFile=path.join(directory,'text-report.pdf'),multiFile=path.join(directory,'multi-report.pdf'),invalid=path.join(directory,'not-pdf.txt'),forged=path.join(directory,'forged.pdf'),broken=path.join(directory,'broken.pdf')
    fs.writeFileSync(textFile,textPdf([lines]));fs.writeFileSync(multiFile,textPdf([lines,['第二頁報告','王小明持續接受語言治療。','Second page assessment report.']]))
    fs.writeFileSync(invalid,'not a PDF');fs.writeFileSync(forged,'not a PDF');fs.writeFileSync(broken,'%PDF-1.7\ncorrupt')
    await open();await upload(textFile);await waitText('③ 去識別化確認')
    let preview=await evaluate('document.querySelector("dialog textarea").value')
    for(const value of ['王小明','A123456789','2015/03/02','0912-345-678','高雄市苓雅區和平一路123號','林美華','高雄市快樂國民小學','陳大文','高雄市仁愛醫院'])assert.ok(!preview.includes(value),value)
    assert.ok(preview.includes('精細動作與語言理解需要持續支持。'));assert.ok(/Fine\s+motor/.test(preview),preview)
    assert.ok((await text()).includes('PDF 文字層'));assert.ok((await text()).includes('已遮蔽 9 項'))
    assert.equal(await evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="確認並進行 AI 分析").disabled'),true)
    await evaluate('document.querySelector("dialog input[type=checkbox]").click()');await click('確認並進行 AI 分析');await waitText('AI 文件分析將於下一階段串接。')
    assert.equal(await evaluate('document.querySelectorAll(".assessment-table-row").length'),6)
    await click('關閉');await open();assert.ok((await text()).includes('① 上傳評估文件'));assert.equal(await evaluate('Boolean(document.querySelector("dialog textarea"))'),false)
    await upload(multiFile);await waitText('③ 去識別化確認');assert.equal(await evaluate('document.querySelectorAll("dialog dd")[1].textContent'),'2')
    preview=await evaluate('document.querySelector("dialog textarea").value');assert.ok(preview.includes('第二頁報告'));assert.ok(!preview.includes('王小明'))
    await click('重新選擇文件');await upload(invalid);await waitText('僅支援 PDF 評估報告');assert.equal(await evaluate('Boolean(document.querySelector("dialog textarea"))'),false)
    await upload(forged);await waitText('檔案內容不是有效的 PDF')
    await upload(broken);await waitText('無法解析此 PDF')
    await upload(textFile);await waitText('③ 去識別化確認')
    // Editing preview invalidates teacher confirmation and cannot fall back to raw text.
    await evaluate('document.querySelector("dialog input[type=checkbox]").click()')
    await evaluate(`(()=>{const t=document.querySelector('dialog textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'');t.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    assert.equal(await evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="確認並進行 AI 分析").disabled'),true)
    assert.equal(await evaluate('document.querySelector("dialog input[type=checkbox]").checked'),false)
    console.log('PASS browser text PDFs: real PDF.js, Chinese/English, 1+2 pages, all 9 redactions/counts, review/confirm, no fake records, reopen/reselect, non-PDF/signature/corrupt rejection, empty-edit gate')

    // Draw synthetic report pixels in the real browser, then embed as image-only PDFs.
    const jpegs=await evaluate(`(()=>{const pages=${JSON.stringify([lines,['第二頁綜合評估報告','學生姓名：王小明','語言理解與精細動作需要支持。','English language assessment report.','Fine motor skills need support.']])};return pages.map(lines=>{const c=document.createElement('canvas');c.width=1200;c.height=1600;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='36px "Microsoft JhengHei", Arial';lines.forEach((line,i)=>ctx.fillText(line,50,80+i*80));return c.toDataURL('image/jpeg',.98).split(',')[1]})})()`)
    const scanFile=path.join(directory,'scan-report.pdf');fs.writeFileSync(scanFile,scanPdf(jpegs))
    await click('重新選擇文件')
    await evaluate(`window.__progress=[];window.__observer=new MutationObserver(()=>{const s=document.querySelector('dialog [role=status]');if(s)window.__progress.push(s.textContent)});window.__observer.observe(document.querySelector('dialog'),{childList:true,subtree:true,characterData:true})`)
    await upload(scanFile);await waitText('③ 去識別化確認',180000)
    preview=await evaluate('document.querySelector("dialog textarea").value')
    assert.ok((await text()).includes('OCR（繁體中文＋英文）'));assert.equal(await evaluate('document.querySelectorAll("dialog dd")[1].textContent'),'2')
    assert.ok(/Fine motor/i.test(preview),preview);assert.ok(/語言|精細|評估/.test(preview),preview)
    assert.ok(!preview.includes('王小明'));assert.ok(preview.includes('[學生姓名]'))
    assert.ok((await evaluate('window.__progress')).some(t=>t.includes('第 2 / 2 頁')))
    fs.writeFileSync(path.join(directory,'ocr-preview.txt'),preview)
    console.log('PASS browser scanned PDF: real Tesseract chi_tra+eng, 2 image-only pages, page progress, Chinese+English recognized, deidentified preview, local engine/models')

    // Closing an active operation must abort it and prevent stale text after reopening.
    await click('重新選擇文件');await upload(scanFile);await click('關閉');await open();await pause(1000)
    assert.ok((await text()).includes('① 上傳評估文件'));assert.equal(await evaluate('Boolean(document.querySelector("dialog textarea"))'),false)
    // Fail only OCR core loading to verify the real user-visible OCR error branch.
    blockOcr=true;await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true})
    await upload(scanFile);await waitText('OCR 初始化失敗或逾時',30000)
    assert.equal(await evaluate('Boolean(document.querySelector("dialog textarea"))'),false)
    assert.ok((await text()).includes('① 上傳評估文件'))
    blockOcr=false;await upload(textFile);await waitText('③ 去識別化確認')
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await pause(200)
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(directory,'preview-mobile.png'),Buffer.from(shot.data,'base64'))
    assert.ok(await evaluate('document.querySelector("dialog").getBoundingClientRect().width<=390'),JSON.stringify(await evaluate('({innerWidth,clientWidth:document.documentElement.clientWidth,dialog:document.querySelector("dialog").getBoundingClientRect().toJSON(),style:getComputedStyle(document.querySelector("dialog")).width})')))
    await click('關閉')
    assert.equal(await evaluate('localStorage.length'),0)
    // The host's AdGuard injects its own content scripts into Chrome, outside app code.
    const external=requests.filter(url=>/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:4176')&&new URL(url).hostname!=='local.adguard.org')
    assert.deepEqual(external,[])
    assert.deepEqual(exceptions,[])
    console.log('PASS browser: close/abort/reopen, real OCR asset failure/recovery, mobile modal, no external application requests, no raw document persistence, no page exceptions')
    console.log('Synthetic fixtures and screenshot:',directory)
  }finally{socket?.close();browser?.kill();server.kill()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
