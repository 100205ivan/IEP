/* Run: node scripts/verify-assessment-documents.cjs */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file) {
  const sandbox = { exports: {}, Date, Error, TextDecoder }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, sandbox)
  return sandbox.exports
}
const { deidentifyAssessmentReport: mask, confirmAssessmentDocument: confirm } = load('src/services/assessmentReportDeidentification.ts')
const json = value => JSON.parse(JSON.stringify(value))
const rawText = `綜合評估報告
學生姓名：王小明
身分證字號：A123456789
出生日期：民國104年3月2日
電話：0912-345-678
住址：高雄市苓雅區和平一路123號
家長姓名：林美華
學校名稱：高雄市快樂國民小學
醫師姓名：陳大文
醫療院所：高雄市仁愛醫院
王小明與林美華前來評估，陳大文建議持續語言治療。
評估日期：2026/10/08
Fine motor assessment. 精細動作需要支持。`
const result = mask(rawText, { studentName: ['王小明'] })
for (const value of ['王小明','A123456789','104年3月2日','0912-345-678','高雄市苓雅區和平一路123號','林美華','高雄市快樂國民小學','陳大文','高雄市仁愛醫院']) assert.ok(!result.deidentifiedText.includes(value),value)
for (const type of ['studentName','nationalId','birthDate','phone','address','guardianName','school','doctorName','medicalInstitution']) assert.ok(result.redactions.some(item=>item.type===type),type)
assert.ok(result.deidentifiedText.includes('評估日期：2026/10/08'))
assert.ok(result.deidentifiedText.includes('Fine motor assessment. 精細動作需要支持。'))
assert.ok(result.deidentifiedText.includes('與[家長／法定代理人姓名]前來評估，[醫師姓名]建議持續語言治療。'))
assert.equal(result.redactions.length,12)
assert.equal(mask(result.deidentifiedText).redactions.length,0)
assert.equal(mask(result.deidentifiedText).deidentifiedText,result.deidentifiedText)
for(let i=1;i<result.redactions.length;i++) assert.ok(result.redactions[i-1].end<=result.redactions[i].start)
assert.ok(!JSON.stringify(result.redactions).includes('王小明'))
assert.equal(mask('王 小 明需要支持。',{studentName:['王小明']}).deidentifiedText,'[學生姓名]需要支持。')
assert.equal(mask('[王小明]',{studentName:['王小明']}).deidentifiedText,'[[學生姓名]]')
assert.equal(mask('陳美玲需要語言治療。').redactions.length,0,'do not guess unlabelled Chinese names')
assert.equal(mask('王小明',{studentName:['王小明'],guardianName:['王小明']}).redactions.length,1,'overlap counted once')
for(const date of ['2015/03/02','104-3-2','2015.3.2','104年3月2日','西元2015年03月02日']) assert.equal(mask(`出生日期：${date}`).deidentifiedText,'出生日期：[出生日期]')
for(const phone of ['0912345678','0912-345-678','(02)2345-6789','07-1234567','+886 912 345 678','02-2345-6789 分機123']) assert.equal(mask(`電話：${phone}`).deidentifiedText,'電話：[電話]',phone)
assert.equal(mask('身分證：A 1 2 3 4 5 6 7 8 9').deidentifiedText,'身分證：[身分證字號]')
assert.equal(mask('地址：高雄市苓雅區和平一路123號 電話：0912345678').deidentifiedText,'地址：[地址] 電話：[電話]')
assert.equal(mask('主治醫師姓名：陳大文\n家長姓名：林美華').deidentifiedText,'主治醫師姓名：[醫師姓名]\n家長姓名：[家長／法定代理人姓名]')
assert.equal(mask('學校名稱：高雄市快樂國民小學\n醫院名稱：高雄市仁愛醫院').deidentifiedText,'學校名稱：[學校名稱]\n醫院名稱：[醫療院所名稱]')
assert.ok(mask('醫院建議持續治療，學校提供支持。').deidentifiedText.includes('醫院建議持續治療'))
assert.equal(mask('DOB:2015-3-2').deidentifiedText,'DOB:[出生日期]')
const doc={fileName:'report.pdf',pageCount:1,extractionMethod:'text-layer',rawText,normalizedText:rawText,truncated:false,...result,deidentificationCompleted:true,confirmedAt:null}
assert.throws(()=>confirm(doc,false))
assert.throws(()=>confirm({...doc,deidentifiedText:' '},true))
assert.throws(()=>confirm({...doc,deidentificationCompleted:false},true))
const approved=confirm(doc,true)
assert.equal(approved.document.rawText,rawText)
assert.notEqual(approved.input.deidentifiedText,rawText)
assert.deepEqual(Object.keys(approved.input).sort(),['confirmedAt','deidentifiedText'])
assert.ok(!JSON.stringify(approved.input).includes('A123456789'))
console.log('PASS deidentification: all 9 types, names/repeats, spaced names/IDs, birth dates, phones/extensions, address boundary, schools/doctor/hospital, overlaps/counts/idempotence, preserve clinical text')
console.log('PASS confirmation: review required, completed/nonempty gate, rawText preserved separately, future input excludes rawText/file name/redaction originals')
const current=load('src/utils/recognizedRegionText.ts')
const old=load('../references/EyeEP/frontend/src/utils/recognizedRegionText.ts')
for(const bullet of ['@','®','●','•','○','◉','◦','▪','■','※']) {
  const text=`  ${bullet} 精細  動作\r\n\r\n語言 理解，fine  motor，user@example.com`
  assert.equal(current.postProcessOcrText(text),old.postProcessOcrText(text))
  assert.ok(current.postProcessOcrText(text).includes('• 精細動作'))
}
assert.equal(current.postProcessOcrText('評估 摘要：\n☑ 語言 治療，發展 遲爰。'),'評估摘要：\n☑ 語言治療，發展遲爰。')
console.log('PASS OCR normalization: exact legacy utility, all 10 bullet markers, Chinese spacing, paragraphs/English/punctuation, no spelling/checkbox reinterpretation')
