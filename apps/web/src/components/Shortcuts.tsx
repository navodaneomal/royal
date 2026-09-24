import React from 'react'
import { Dialog } from './Dialog'
import { t } from '../lib/i18n'

export function Shortcuts({ onClose }: { onClose: () => void }) {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
  const rows: [React.ReactNode, string][] = [
    [<><kbd>{mod}</kbd> + <kbd>K</kbd></>, t('keys.palette')],
    [<kbd>?</kbd>, t('keys.help')],
    [<kbd>/</kbd>, t('keys.search')],
    [<><kbd>g</kbd> then <kbd>s</kbd> <kbd>a</kbd> <kbd>o</kbd> <kbd>t</kbd></>, t('keys.go')],
    [<kbd>Esc</kbd>, t('keys.escape')],
    [<kbd>,</kbd>, t('keys.drawer')],
    [<kbd>f</kbd>, t('keys.fullscreen')],
  ]
  return (
    <Dialog title={t('keys.title')} onClose={onClose}>
      <table className="keys"><tbody>{rows.map(([k, d], i) => <tr key={i}><td>{k}</td><td>{d}</td></tr>)}</tbody></table>
      <p className="small">{t('keys.note')}</p>
      <div className="btn-row"><button className="btn" data-autofocus onClick={onClose}>{t('common.close')}</button></div>
    </Dialog>
  )
}
