/* "Open on your phone": a QR code drawn as one SVG path (crisp at any size,
   no canvas, no network), plus a share dialog with copy + native share. */
import React, { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Dialog } from './Dialog'
import { t } from '../lib/i18n'
import { LinkIcon, ShareIcon } from './Icons'

export function QrCode({ text, label }: { text: string; label: string }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const size = qr.getModuleCount()
    let path = ''
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.isDark(y, x)) path += `M${x} ${y}h1v1h-1z`
    return { d: path, n: size }
  }, [text])
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  )
}

export function ShareDialog({ title, url, text, onClose }: { title: string; url: string; text?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <Dialog title={t('share.title', { title })} onClose={onClose}>
      <p>{t('share.body')}</p>
      <div className="qr">
        <QrCode text={url} label={t('share.qrLabel', { title })} />
        <span className="url">{url}</span>
      </div>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <button className="btn" data-autofocus onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { /* no clipboard: the URL is on screen */ } }}>
          <LinkIcon /> {copied ? t('share.copied') : t('share.copy')}
        </button>
        {'share' in navigator && (
          <button className="btn secondary" onClick={() => navigator.share({ title, text, url }).catch(() => {})}><ShareIcon /> {t('share.native')}</button>
        )}
        <button className="btn ghost" onClick={onClose}>{t('common.close')}</button>
      </div>
    </Dialog>
  )
}
