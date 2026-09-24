/* First run: "How do you like to read?" — three short steps that set the
   one accessibility profile every story receives. Skippable; replayable
   from Settings and the command palette. */
import React, { useState } from 'react'
import { Dialog } from './Dialog'
import { useApp } from '../context'
import { t } from '../lib/i18n'

function Pick({ prefs, update, k, v, title, hint }: { prefs: any; update: (p: any) => void; k: string; v: any; title: string; hint?: string }) {
  return (
    <button type="button" className="choice-card" aria-pressed={prefs[k] === v} onClick={() => update({ [k]: v })}>
      <strong>{title}</strong>{hint && <span>{hint}</span>}
    </button>
  )
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { prefs, updatePrefs } = useApp()
  const [step, setStep] = useState(0)
  const total = 3
  return (
    <Dialog title={t('onboard.title')} onClose={onDone} wide className="onboard">
      <div className="steps-dots" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <p className="small muted" aria-live="polite">{t('onboard.step', { n: step + 1, total })}</p>

      {step === 0 && (
        <section aria-labelledby="ob-look">
          <h3 id="ob-look">{t('onboard.look')}</h3>
          <p>{t('onboard.lookHint')}</p>
          <div className="choice-grid">
            <Pick prefs={prefs} update={updatePrefs} k="colorScheme" v="system" title={t('scheme.system')} />
            <Pick prefs={prefs} update={updatePrefs} k="colorScheme" v="light" title={t('scheme.light')} />
            <Pick prefs={prefs} update={updatePrefs} k="colorScheme" v="dark" title={t('scheme.dark')} />
          </div>
          <div className="field">
            <label htmlFor="ob-scale">{t('settings.textSize', { pct: Math.round(prefs.textScale * 100) })}</label>
            <input id="ob-scale" type="range" min={0.8} max={2} step={0.1} value={prefs.textScale} onChange={(e) => updatePrefs({ textScale: Number(e.target.value) })} />
          </div>
          <div className="choice-grid">
            <Pick prefs={prefs} update={updatePrefs} k="contrast" v="normal" title={t('contrast.normal')} />
            <Pick prefs={prefs} update={updatePrefs} k="contrast" v="more" title={t('contrast.more')} />
          </div>
          <div className="sample"><p>{t('onboard.sample')}</p></div>
        </section>
      )}
      {step === 1 && (
        <section aria-labelledby="ob-motion">
          <h3 id="ob-motion">{t('onboard.motion')}</h3>
          <p>{t('onboard.motionHint')}</p>
          <div className="choice-grid">
            <Pick prefs={prefs} update={updatePrefs} k="motion" v="full" title={t('onboard.motionFull')} hint={t('onboard.motionFullHint')} />
            <Pick prefs={prefs} update={updatePrefs} k="motion" v="reduced" title={t('onboard.motionReduced')} hint={t('onboard.motionReducedHint')} />
            <Pick prefs={prefs} update={updatePrefs} k="motion" v="none" title={t('onboard.motionNone')} hint={t('onboard.motionNoneHint')} />
          </div>
          <label className="switch"><input type="checkbox" checked={prefs.sound === 'muted'} onChange={(e) => updatePrefs({ sound: e.target.checked ? 'muted' : 'on' })} /> {t('onboard.soundMuted')}</label>
          <br />
          <label className="switch"><input type="checkbox" checked={prefs.captions} onChange={(e) => updatePrefs({ captions: e.target.checked })} /> {t('settings.captions')}</label>
        </section>
      )}
      {step === 2 && (
        <section aria-labelledby="ob-type">
          <h3 id="ob-type">{t('onboard.type')}</h3>
          <div className="choice-grid">
            <Pick prefs={prefs} update={updatePrefs} k="fontMode" v="story" title={t('font.story')} hint={t('settings.typefaceHint')} />
            <Pick prefs={prefs} update={updatePrefs} k="fontMode" v="readable" title={t('font.readable')} />
            <Pick prefs={prefs} update={updatePrefs} k="fontMode" v="dyslexia-friendly" title={t('font.dyslexia')} />
          </div>
          <div className="choice-grid">
            <Pick prefs={prefs} update={updatePrefs} k="puzzleAssist" v="standard" title={t('onboard.puzzleStandard')} />
            <Pick prefs={prefs} update={updatePrefs} k="puzzleAssist" v="untimed" title={t('onboard.puzzleUntimed')} />
            <Pick prefs={prefs} update={updatePrefs} k="puzzleAssist" v="guided" title={t('onboard.puzzleGuided')} />
          </div>
          <p className="small">{t('onboard.puzzleHint')}</p>
          <div className="sample"><p>{t('onboard.sample')}</p></div>
        </section>
      )}

      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn ghost" onClick={onDone}>{t('onboard.skip')}</button>
        <span className="btn-row" style={{ margin: 0 }}>
          {step > 0 && <button type="button" className="btn secondary" onClick={() => setStep(step - 1)}>{t('common.back')}</button>}
          {step < total - 1
            ? <button type="button" className="btn" onClick={() => setStep(step + 1)}>{t('common.next')}</button>
            : <button type="button" className="btn" onClick={onDone}>{t('onboard.done')}</button>}
        </span>
      </div>
    </Dialog>
  )
}
