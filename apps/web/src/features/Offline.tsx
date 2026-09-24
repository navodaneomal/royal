/* Offline centre: everything on this device, the browser's quota, one-tap
   "download all", persistence, and automatic re-download + re-verify when
   an edition is promoted. Removing a download never touches progress. */
import React, { useEffect, useState } from 'react'
import { useApp } from '../context'
import { releaseFor, coverUrl } from '../lib/catalog'
import { downloadsList, downloadRelease, deleteDownload, storageEstimate, requestPersistence, isPersisted, refreshDownloads } from '../lib/downloads'
import { getKv, setKv } from '../lib/store'
import { t, fmtDate, fmtBytes } from '../lib/i18n'
import { Cover } from '../components/Cover'

export function OfflineCentre() {
  const { stories, toast } = useApp()
  const [items, setItems] = useState<any[]>([])
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState(false)
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setItems(await downloadsList())
    setEst(await storageEstimate())
    setPersisted(await isPersisted())
    setAuto(await getKv('autoUpdateDownloads', true))
  }
  useEffect(() => { load() }, [])

  const list = stories ?? []
  const downloadedIds = new Set(items.map((d) => d.releaseId))
  const eligible = list.filter((s) => { const r = releaseFor(s); return r && !r.disabled && r.meta?.offlineEligible && !downloadedIds.has(r.releaseId) })
  const onlineOnly = list.filter((s) => { const r = releaseFor(s); return r && !r.meta?.offlineEligible })
  const pct = est && est.quota ? Math.min(100, (est.usage / est.quota) * 100) : 0

  async function fetchOne(slug: string) {
    const s = list.find((x) => x.slug === slug)!
    const r = releaseFor(s)!
    setBusy(t('offline.downloading', { title: s.title }))
    try { await downloadRelease(s, r) } catch (e: any) { toast(t('detail.downloadFailed', { error: e.message })) }
  }
  async function downloadAll() {
    for (const s of eligible) await fetchOne(s.slug)
    setBusy(null); toast(t('detail.downloaded')); load()
  }

  return (
    <main className="page">
      <h1>{t('offline.title')}</h1>
      <p className="lede">{t('offline.lede')}</p>

      <section aria-labelledby="h-storage" className="panel">
        <h2 id="h-storage" style={{ marginTop: 0 }}>{t('offline.storage')}</h2>
        {est ? (
          <>
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t('offline.storage')}>
              <i style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
            <p className="small">{t('offline.usage', { used: fmtBytes(est.usage), quota: fmtBytes(est.quota) })}</p>
          </>
        ) : <p className="small muted">{t('offline.unknown')}</p>}
        <p className="small">{persisted ? t('offline.persisted') : t('offline.notPersisted')}</p>
        <div className="btn-row">
          {!persisted && <button className="btn secondary small" onClick={async () => { setPersisted(await requestPersistence()) }}>{t('offline.persist')}</button>}
          {eligible.length > 0 && <button className="btn small" disabled={!!busy} onClick={downloadAll}>{t('offline.downloadAll', { n: eligible.length })}</button>}
        </div>
        {busy && <p className="small" role="status">{busy}</p>}
        <label className="switch">
          <input type="checkbox" checked={auto} onChange={async (e) => {
            setAuto(e.target.checked); await setKv('autoUpdateDownloads', e.target.checked)
            if (e.target.checked && stories) { const r = await refreshDownloads(stories, toast); if (r.updated) { toast(t('offline.updated', { n: r.updated })); load() } }
          }} /> {t('offline.auto')}
        </label>
        <p className="small muted" style={{ marginTop: '0.3rem' }}>{t('offline.autoHint')}</p>
      </section>

      <h2>{t('offline.downloaded')}</h2>
      {!items.length && <p className="small muted">{t('offline.none')}</p>}
      <ul className="list">
        {items.map((d) => {
          const s = list.find((x) => x.slug === d.slug)
          const prod = s && releaseFor(s)
          const current = prod?.releaseId === d.releaseId
          return (
            <li key={d.releaseId}>
              {s && <Cover className="thumb" src={coverUrl(s, prod)} title={s.title} />}
              <span className="grow">
                <strong>{s?.title ?? d.slug}</strong><br />
                <span className="small muted">{fmtBytes(d.bytes)} · {t('offline.verified', { date: fmtDate(d.at) })} · <span className={`badge ${current ? 'good' : 'warn'}`}>{current ? t('offline.current') : t('offline.outdated')}</span></span>
              </span>
              <span className="btn-row" style={{ margin: 0 }}>
                {s && prod && !current && <button className="btn small" onClick={async () => { await fetchOne(s.slug); await deleteDownload(d.releaseId); setBusy(null); load() }}>{t('offline.update', { version: prod.version })}</button>}
                {s && <a className="btn small secondary" href={`#/play/${s.slug}/offline`}>{t('detail.playOffline')}</a>}
                <button className="btn small danger" onClick={async () => { await deleteDownload(d.releaseId); toast(t('detail.removed')); load() }}>{t('offline.remove')}</button>
              </span>
            </li>
          )
        })}
      </ul>

      {eligible.length > 0 && (
        <>
          <h2>{t('offline.available')}</h2>
          <ul className="list">
            {eligible.map((s) => {
              const r = releaseFor(s)!
              return (
                <li key={s.slug}>
                  <Cover className="thumb" src={coverUrl(s, r)} title={s.title} />
                  <span className="grow"><strong>{s.title}</strong><br /><span className="small muted">{fmtBytes(r.meta?.sizeBytes ?? 0)}</span></span>
                  <button className="btn small secondary" disabled={!!busy} onClick={async () => { await fetchOne(s.slug); setBusy(null); load() }}>{t('detail.download', { size: fmtBytes(r.meta?.sizeBytes ?? 0) })}</button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {onlineOnly.length > 0 && <p className="small muted">{t('offline.onlineOnly')}: {onlineOnly.map((s) => s.title).join(', ')}</p>}
    </main>
  )
}
