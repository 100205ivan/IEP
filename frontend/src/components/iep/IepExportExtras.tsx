import { useEffect, useState } from 'react'
import { referenceOptions, type TeamMember } from '../../models/referenceForms'

export function IepTeamFields({ value, onChange, disabled }: { value: TeamMember[]; onChange: (value: TeamMember[]) => void; disabled: boolean }) {
  const update = (id: string, patch: Partial<TeamMember>) => onChange(value.map(member => member.id === id ? { ...member, ...patch } : member))
  return <details className="pdf-export-options"><summary>IEP 團隊成員<span>隨「儲存 IEP」保存</span></summary><p>名單會填入封面團隊表。簽名欄保留供列印後簽署；同一角色可加入多位成員。</p><fieldset className="reference-form" disabled={disabled} aria-label="IEP 團隊成員"><legend>團隊名單</legend>{value.map(member => <div className="reference-grid" key={member.id}><label>團隊角色<select value={member.role} onChange={e => update(member.id, { role: e.target.value })}>{referenceOptions.teamRoles.map(role => <option key={role}>{role}</option>)}</select></label><label>姓名<input maxLength={120} value={member.name} onChange={e => update(member.id, { name: e.target.value })} /></label><label>職稱／補充<input maxLength={2000} value={member.title} onChange={e => update(member.id, { title: e.target.value })} /></label><button className="text-button" type="button" aria-label={`移除${member.name || member.role}`} onClick={() => onChange(value.filter(row => row.id !== member.id))}>移除成員</button></div>)}<button className="button button--secondary" type="button" onClick={() => onChange([...value, { id: crypto.randomUUID(), role: referenceOptions.teamRoles[0], name: '', title: '' }])}>新增團隊成員</button></fieldset></details>
}

type ImageRecord = { kind: string; fileName: string; updatedAt: string }
export function IepCertificateFields({ studentId, iepId, disabled }: { studentId?: string; iepId?: string; disabled: boolean }) {
  const [records, setRecords] = useState<ImageRecord[]>([]), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const base = studentId && iepId ? `/api/students/${studentId}/ieps/${iepId}/attachments` : ''
  useEffect(() => {
    if (!base) return
    const abort = new AbortController()
    void fetch(base, { signal: abort.signal }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || '影本載入失敗。'); setRecords(result.data) }).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : '影本載入失敗。') })
    return () => abort.abort()
  }, [base])
  const mutate = async (kind: string, file?: File) => {
    setError(''); setNotice(''); setBusy(kind)
    try {
      if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024)) throw new Error('請選擇 5 MB 以內的 PNG 或 JPEG 圖片。')
      const response = await fetch(`${base}/${kind}`, file ? { method: 'PUT', headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }, body: file } : { method: 'DELETE' })
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || '影本儲存失敗。')
      const listed = await fetch(base), payload = await listed.json(); if (!listed.ok) throw new Error('影本已儲存，重新載入清單失敗。')
      setRecords(payload.data); setNotice(file ? '影本已儲存至此份 IEP。重新產生預覽即可查看。' : '影本已移除。重新產生預覽即可更新。')
    } catch (reason) { setError(reason instanceof Error ? reason.message : '影本儲存失敗。') } finally { setBusy('') }
  }
  return <details className="pdf-export-options"><summary>身心障礙證明影本<span>上傳後立即保存</span></summary><p>正反面各一張，支援 5 MB 以內的 PNG、JPEG。影本會立即保存至這位學生的本學年度 IEP，並帶入 PDF 黏貼處。</p>{!base && <p>請先儲存 IEP，再上傳影本。</p>}<fieldset className="reference-grid" disabled={disabled || !base || !!busy} aria-label="證明影本">{[['certificate-front', '證明正面'], ['certificate-back', '證明反面']].map(([kind, label]) => {
    const record = records.find(row => row.kind === kind)
    return <div key={kind}><label>{label}<input type="file" accept="image/png,image/jpeg" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void mutate(kind, file) }} /></label>{record && <><img className="certificate-preview" src={`${base}/${kind}?v=${encodeURIComponent(record.updatedAt)}`} alt={label} /><p>{record.fileName}</p><button className="text-button" type="button" onClick={() => void mutate(kind)}>移除{label}</button></>}{busy === kind && <p role="status">儲存中…</p>}</div>
  })}</fieldset>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</details>
}
