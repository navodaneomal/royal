/**
 * Layout and preference plumbing shared by every Quick Book theme. Themes
 * only set tokens (--qb-*) and add flourishes; everything a reader relies
 * on — focus rings, text scale, line height, font mode, motion — lives here
 * once, so no theme can forget it.
 */
export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{--qb-scale:1;--qb-lh:1.72;--qb-measure:36em;-webkit-text-size-adjust:100%;scroll-behavior:smooth}
html[data-lh="compact"]{--qb-lh:1.45}
html[data-lh="relaxed"]{--qb-lh:1.98}
body{margin:0;min-height:100vh;background:var(--qb-bg);color:var(--qb-ink);font-family:var(--qb-font-body);
  font-size:calc(clamp(17px,.55vw + 14.5px,20px) * var(--qb-scale));line-height:var(--qb-lh);text-rendering:optimizeLegibility}
html[data-font="readable"] body,html[data-font="readable"] h1,html[data-font="readable"] h2,html[data-font="readable"] h3{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.01em;text-transform:none}
html[data-font="dyslexia-friendly"] body,html[data-font="dyslexia-friendly"] h1,html[data-font="dyslexia-friendly"] h2,html[data-font="dyslexia-friendly"] h3{font-family:Verdana,Tahoma,"DejaVu Sans",sans-serif;letter-spacing:.035em;word-spacing:.12em;text-transform:none;font-style:normal}
html[data-font="dyslexia-friendly"] em{font-style:normal;text-decoration:underline;text-underline-offset:.2em}
a{color:var(--qb-accent)}
:focus-visible{outline:3px solid var(--qb-accent);outline-offset:3px;border-radius:4px}
.qb-skip{position:absolute;left:-9999px;top:.5rem;z-index:20;background:var(--qb-surface);color:var(--qb-ink);padding:.6rem 1rem}
.qb-skip:focus{left:.5rem}
.qb-atmosphere{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.qb-top{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:1rem;
  padding:.55rem clamp(1rem,4vw,2rem);background:color-mix(in srgb,var(--qb-bg) 88%,transparent);border-bottom:1px solid var(--qb-line);font-size:.82em}
.qb-booktitle{margin:0;color:var(--qb-muted);letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qb-toc{position:relative}
.qb-toc ol{position:absolute;right:0;top:calc(100% + .4rem);min-width:15rem;max-width:80vw;margin:0;padding:.4rem;list-style:none;background:var(--qb-surface);border:1px solid var(--qb-line);border-radius:10px;box-shadow:0 18px 40px -20px rgba(0,0,0,.45)}
.qb-toc ol button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--qb-ink);font:inherit;padding:.45rem .6rem;border-radius:6px;cursor:pointer}
.qb-toc ol button[disabled]{color:var(--qb-muted);cursor:default}
.qb-toc ol button[aria-current="true"]{background:color-mix(in srgb,var(--qb-accent) 14%,transparent)}
main{position:relative;z-index:1;max-width:calc(var(--qb-measure) + 4rem);margin:0 auto;padding:clamp(1.4rem,5vw,3.4rem) clamp(1rem,4vw,2rem) 5rem}
h1,h2,h3,h4{font-family:var(--qb-font-head);line-height:1.18;color:var(--qb-ink)}
h1{font-size:clamp(2.1rem,6vw,3.3rem);margin:.2em 0 .5em}
h2{font-size:clamp(1.55rem,4vw,2.2rem);margin:.1em 0 .8em}
h2:focus{outline:none}
h2:focus-visible{outline:3px solid var(--qb-accent)}
.qb-kicker{color:var(--qb-muted);margin:0 0 .4em;font-size:.86em;letter-spacing:.06em}
.qb-prose>p,.qb-prose li,.qb-epigraph p{max-width:var(--qb-measure);hyphens:auto}
.qb-prose p{margin:0 0 1em}
blockquote{margin:1.4em 0;padding:.2em 0 .2em 1.1em;border-left:3px solid var(--qb-line);color:var(--qb-muted);font-style:italic}
.qb-break{border:0;margin:2.2em 0;text-align:center;color:var(--qb-muted);height:auto;overflow:visible}
.qb-break::after{letter-spacing:.4em}
.qb-code{background:var(--qb-surface);border:1px solid var(--qb-line);border-radius:8px;padding:1em;overflow:auto;font-size:.88em;white-space:pre-wrap}
.qb-figure{margin:1.8em 0;text-align:center}
.qb-figure img{max-width:100%;height:auto;border-radius:10px}
.qb-figure figcaption{color:var(--qb-muted);font-size:.86em;margin-top:.5em}
.qb-cover{text-align:center;padding-top:clamp(1rem,10vh,6rem)}
.qb-epigraph{color:var(--qb-muted);font-style:italic;margin:1.6em auto;max-width:28em}
.qb-meta{color:var(--qb-muted);font-size:.84em}
.qb-btn{font:inherit;font-size:.95em;cursor:pointer;background:var(--qb-accent);color:var(--qb-accent-ink);border:1px solid var(--qb-accent);border-radius:999px;padding:.62em 1.35em;min-height:44px}
.qb-btn:hover{filter:brightness(1.06)}
.qb-link{font:inherit;cursor:pointer;background:none;border:0;color:var(--qb-accent);text-decoration:underline;text-underline-offset:.2em;padding:.4em .2em;min-height:44px}
.qb-chapter-foot{margin-top:3em;padding-top:1.2em;border-top:1px solid var(--qb-line)}
.qb-tools{display:flex;flex-wrap:wrap;gap:.4em 1.2em;font-size:.84em}
.qb-note-form{margin:.8em 0;display:grid;gap:.4em}
.qb-note-form label{font-size:.86em;color:var(--qb-muted)}
.qb-note-form textarea{font:inherit;font-size:.95em;color:var(--qb-ink);background:var(--qb-surface);border:1px solid var(--qb-line);border-radius:8px;padding:.6em;width:100%;max-width:var(--qb-measure)}
.qb-pager{display:flex;justify-content:space-between;align-items:center;gap:1em;margin-top:1.2em}
.qb-secret{margin:1.4em 0}
.qb-secret-btn{font:inherit;font-size:.9em;cursor:pointer;background:transparent;color:var(--qb-accent);border:1px dashed var(--qb-line);border-radius:10px;padding:.55em .9em;min-height:44px;text-align:left}
.qb-secret-btn[aria-expanded="true"]{border-style:solid}
.qb-glyph{display:inline-block}
html[data-motion="full"] .qb-secret-btn[aria-expanded="false"] .qb-glyph{animation:qb-glint 3.2s ease-in-out infinite}
@keyframes qb-glint{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
.qb-secret-body{margin-top:.8em;padding:1em 1.2em;background:var(--qb-surface);border:1px solid var(--qb-line);border-radius:12px}
.qb-secret-name{font-family:var(--qb-font-head);font-size:1.05em;margin:0 0 .4em;color:var(--qb-accent)}
.qb-choice{margin:2em 0;padding:1.1em 1.2em;border:1px solid var(--qb-line);border-radius:14px;background:var(--qb-surface)}
.qb-choice legend{padding:0 .4em;font-family:var(--qb-font-head);font-size:1.05em}
.qb-options{display:flex;flex-wrap:wrap;gap:.6em;margin:.4em 0}
.qb-option{font:inherit;font-size:.95em;cursor:pointer;background:transparent;color:var(--qb-ink);border:1px solid var(--qb-accent);border-radius:999px;padding:.55em 1.1em;min-height:44px}
.qb-option[aria-pressed="true"]{background:var(--qb-accent);color:var(--qb-accent-ink)}
.qb-option[disabled]:not([aria-pressed="true"]){color:var(--qb-muted);border-style:dashed;border-color:var(--qb-muted);cursor:default}
.qb-chosen{margin:.4em 0 0;color:var(--qb-accent)}
.qb-choice-note{margin:.4em 0 0;color:var(--qb-muted);font-size:.8em}
.qb-branch{margin:1.2em 0}
.qb-ending{margin:2.6em 0 1em;padding:1.6em 0 0;border-top:1px solid var(--qb-line)}
.qb-ending-mark{text-align:center;margin:1.8em 0 .8em;font-family:var(--qb-font-head);letter-spacing:.12em;text-transform:uppercase;font-size:.9em;color:var(--qb-accent)}
.qb-ending-mark span::before,.qb-ending-mark span::after{content:" — "}
.qb-ending-actions{text-align:center}
.qb-toast{position:fixed;left:50%;bottom:1.2rem;transform:translateX(-50%);z-index:30;max-width:min(92vw,30rem);background:var(--qb-ink);color:var(--qb-bg);border-radius:999px;padding:.5em 1.2em;font-size:.86em;opacity:0;transition:opacity .3s;pointer-events:none;text-align:center}
.qb-toast.on{opacity:1}
[hidden]{display:none!important}
html[data-motion="reduced"] *,html[data-motion="reduced"] *::before,html[data-motion="reduced"] *::after,
html[data-motion="none"] *,html[data-motion="none"] *::before,html[data-motion="none"] *::after{animation:none!important;transition:none!important}
html[data-motion="reduced"],html[data-motion="none"]{scroll-behavior:auto}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition:none!important}html{scroll-behavior:auto}}
@media (max-width:520px){.qb-top{font-size:.76em}.qb-pager{flex-direction:column-reverse;align-items:stretch}.qb-pager .qb-btn{width:100%}}
@media print{.qb-top,.qb-atmosphere,.qb-tools,.qb-pager{display:none}}
`
