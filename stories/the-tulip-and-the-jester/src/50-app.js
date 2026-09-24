<script>
/* ══════════════════════════════════════════════════════════════════
   THE HOUSE — routing, state, atmosphere, sound
   State is held in memory only. Nothing is written to your machine.
   ══════════════════════════════════════════════════════════════════ */
window.__START_APP__ = function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion==='off';

const S={read:new Set(), secrets:new Set(), said:new Set(), motion:!reduced, sound:false, candle:0, entered:false};
const TOTAL_SECRETS=7;
const chById=id=>CHAPTERS.find(c=>c.id===id);
const idx=id=>CHAPTERS.findIndex(c=>c.id===id);
const progress=()=>S.read.size;
const done=()=>S.read.size>=CHAPTERS.length;

/* ─── secrets ─────────────────────────────────────────────────── */
const SECRETS={
 'candle':{k:'Hidden', t:'The candle', m:'On the threshold, before anything', b:`A candle is a clock that only runs once.\n\nThey used eight hundred of them on the twelfth of April 1750, in iron rings, because the House of Smith has exactly one joke about itself and makes it in every room.\n\nBy four in the morning on the twelfth of April 1751 they had all gone out except six, and nobody had lit any more, and that is how the last dance was lit.`, s:'— found'},
 'part-1:3':{k:'Hidden', t:'The two hundred and seventh gift', m:'Counted twice by a man of sixty-three, at four in the morning', b:`He counted the table twice.\n\nThere was no card, so there was no entry; there was no entry, so there was no gift; and the chamberlain of Rivenelle had been doing the job for thirty years and knew perfectly well that a thing which is not written down did not happen.\n\nIt was a plain red clay pot, unglazed, chipped at the rim, worth about two sous.\n\nIt is the only object in this story that outlives every single person in it.`, s:'— found'},
 'part-4:2':{k:'Hidden', t:'The wolf’s head', m:'Half past midnight, during the fourth figure', b:'unlock:wolf', s:''},
 'part-5:3':{k:'Hidden', t:'Why she knew the name Toussaint', m:'Somewhere around the tenth mile, and then it went out of her head', b:`Mère Toussaint, of the inn yard at Cheneuil, who put down two pails and took his face in both her hands and said <i>you have your father’s hands, do you know that.</i>\n\nGuillaume Toussaint, printer’s apprentice, taken the sixth of January 1732. Number fifteen.\n\nHe went to Cheneuil because there is one house left in France where somebody would say his name out loud without being asked, and he took the Queen of France with him and did not tell her why, and she stood three steps up in the dark of the stair and heard it and did not ask.\n\nShe worked it out in the following March, in about four seconds, and had to sit down.`, s:'— found'},
 'part-7:2':{k:'Hidden', t:'Eleven sous and a coat', m:'The fair of Saint-Germain, March 1750', b:'unlock:coat', s:''},
 'garden:41':{k:'Hidden', t:'Bed forty-one', m:'Against the wall, in the corner, in the shade after four o’clock', b:`Nobody picks it.\n\nShe said that at eighteen, in May, to a young man who had walked from Chartres to hear it, and she had no idea what she was saying, and she meant it absolutely.\n\nIt is the only bed in the garden that was not turned in January, because it was not in the garden. It was on a windowsill in a room upstairs, in a pot with a number scratched into the bottom of it, being nothing.`, s:'— found'},
 'part-10:4':{k:'Hidden', t:'Personne', m:'French. Meaning: nobody. Also: a person.', b:`<i>“She danced as though nobody watched — and for one song, she was nobody’s queen.”</i>\n\nShe wrote that in April 1750, in a small brown book, four days after the ball, before she knew his village or his father or his name or what a tulip was for.\n\nIt is a pun she did not make.\n\nHe found it eleven months later under a candle with six minutes left in it, and laughed once, out loud, in an empty hall — and then stopped laughing, and put his hand over his mouth, and stood there for a while with his eyes shut.`, s:'— found'}
};

const __boot = window.__SF_BOOT__ || null;
if (__boot) {
  (__boot.read || []).forEach(id => S.read.add(id));
  (__boot.secrets || []).forEach(k => {
    S.secrets.add(k);
    const sec = SECRETS[k];
    if (sec && String(sec.b).startsWith('unlock:')) {
      const a = ARCHIVE.find(x => x.id === sec.b.split(':')[1]);
      if (a) a.after = 0;
    }
  });
  if (__boot.rollDone) { (__boot.saidAll ? CHAPTERS : []).length; }
}

function findSecret(key){
  if(S.secrets.has(key))return false;
  S.secrets.add(key);
  document.dispatchEvent(new CustomEvent('sf:secret',{detail:{key}}));
  const sec=SECRETS[key]; if(!sec)return true;
  if(String(sec.b).startsWith('unlock:')){
    const a=ARCHIVE.find(x=>x.id===sec.b.split(':')[1]);
    if(a){a.after=0; openModal(a.kind,a.title,a.meta,a.body,a.sign);}
  } else openModal(sec.k,sec.t,sec.m,sec.b,sec.s);
  toast('Something found — '+S.secrets.size+' of '+TOTAL_SECRETS);
  renderMenu();
  return true;
}

/* ─── toast ───────────────────────────────────────────────────── */
let toastT;
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),3400);}

/* ─── modal ───────────────────────────────────────────────────── */
let lastFocus=null;
function openModal(kind,title,meta,body,sign){
  lastFocus=document.activeElement;
  $('#modalKind').innerHTML=kind||''; $('#modalTitle').innerHTML=title||'';
  $('#modalMeta').innerHTML=meta||''; $('#modalBody').innerHTML=body||''; $('#modalSign').innerHTML=sign||'';
  const m=$('#modal'); m.classList.add('open'); m.setAttribute('aria-hidden','false');
  document.body.classList.add('locked'); $('#modal .x').focus();
}
function closeModal(){
  const m=$('#modal'); m.classList.remove('open'); m.setAttribute('aria-hidden','true');
  document.body.classList.remove('locked'); if(lastFocus&&lastFocus.focus)lastFocus.focus();
}
$$('#modal [data-close]').forEach(b=>b.addEventListener('click',closeModal));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ if($('#modal').classList.contains('open'))closeModal(); else if($('#chrome').classList.contains('open'))toggleMenu(false); }
});

/* ─── menu ────────────────────────────────────────────────────── */
const NAV=[
 ['#/story','The Story','ten parts'],
 ['#/characters','The Characters','who they were'],
 ['#/kingdom','The Kingdom','ground, chronology, garden'],
 ['#/archive','The Archive','letters, ledgers, evidence'],
 ['#/gallery','The Gallery','the plates'],
 ['#/poems','The Poems','the April book'],
 ['#/final','The Final Page','']
];
function renderMenu(){
  const ul=$('#menuList');
  ul.innerHTML=NAV.map(([h,t,s],i)=>{
    const locked=(h==='#/final'&&!done());
    const sub=h==='#/final'?(locked?'sealed until all ten':'unsealed'):s;
    return `<li style="animation-delay:${.06*i+.08}s"><a href="${locked?'#/story':h}" ${locked?'aria-disabled="true" tabindex="-1"':''}>${t}<small>${sub}</small></a></li>`;
  }).join('')+
  `<li style="animation-delay:.62s"><p class="menu-meta">${progress()} of ${CHAPTERS.length} parts read · ${S.secrets.size} of ${TOTAL_SECRETS} secrets</p></li>`;
}
function toggleMenu(force){
  const open=typeof force==='boolean'?force:!$('#menu').classList.contains('open');
  $('#menu').classList.toggle('open',open); $('#chrome').classList.toggle('open',open);
  $('#menuBtn').setAttribute('aria-expanded',String(open));
  $('#menuLabel').textContent=open?'Close':'Index';
  document.body.classList.toggle('locked',open);
  if(open)renderMenu();
}
$('#menuBtn').addEventListener('click',()=>toggleMenu());
$('#menu').addEventListener('click',e=>{ if(e.target.tagName==='A')setTimeout(()=>toggleMenu(false),120); });

/* ─── views ───────────────────────────────────────────────────── */
function head(eyebrow,title,sub){
  return `<header class="phead narrow"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</header>`;
}

function viewStory(){
  return `<div class="view">${head('France, 1750','The Story','Ten parts, and no eleventh. They are meant to be read in order; the house unlocks as you go.')}
  <div class="wrap"><div class="grid">${CHAPTERS.map((c,i)=>{
    const locked=i>0&&!S.read.has(CHAPTERS[i-1].id)&&!S.read.has(c.id);
    return `<a class="card rise ${S.read.has(c.id)?'read':''}" href="#/story/${c.id}" ${locked?'aria-disabled="true" tabindex="-1"':''}>
      <span class="seal" aria-hidden="true"></span>
      <span class="n">Part ${c.num}</span><h3>${c.title}</h3>
      <p>${locked?'<i>Read the part before this one.</i>':c.logline}</p></a>`;}).join('')}</div>
  <p style="text-align:center;margin-top:3rem"><button class="btn" id="readAll" type="button">I have read this before — open the house</button></p>
  </div></div>`;
}

function viewChapter(id){
  const c=chById(id), i=idx(id), prev=CHAPTERS[i-1], next=CHAPTERS[i+1];
  if(!c)return viewStory();
  if(i>0&&!S.read.has(CHAPTERS[i-1].id)){location.hash='#/story';return '';}
  return `<article class="view">
    <div class="narrow"><header class="ch-hero"><p class="ch-num">Part ${c.num}</p><h1 class="ch-title">${c.title}</h1><p class="ch-when">${c.when}</p></header></div>
    <div class="wrap"><figure class="plate rise"><div class="frame">${ART[c.plate]()}</div>
      <figcaption>${c.plateCap}<i>${c.plateSub}</i></figcaption></figure></div>
    <div class="narrow prose">${c.html}</div>
    <div class="narrow"><div class="poem rise"><p class="verse">${c.poem.verse}</p><p class="cap">${c.poem.title} · ${c.poem.cap}</p></div></div>
    <div class="narrow">
      <div class="artnote rise"><h4>Artwork direction — ${c.plateCap.replace(/^Plate [IVX]+ — /,'')}</h4><p>${c.art}</p></div>
      <ul class="facts rise" style="margin-top:2rem">
        <li><b>The event</b><span>${c.event}</span></li>
        <li><b>The mystery</b><span>${c.mystery}</span></li>
        <li><b>The moment</b><span>${c.feeling}</span></li>
        <li><b>The hook</b><span>${c.hook}</span></li>
      </ul>
      <nav class="chnav">
        ${prev?`<a href="#/story/${prev.id}">← Part ${prev.num}<b>${prev.title}</b></a>`:`<a href="#/story">← All parts<b>The Story</b></a>`}
        ${next?`<a href="#/story/${next.id}" style="text-align:right;margin-left:auto">Part ${next.num} →<b>${next.title}</b></a>`
          :`<a href="#/final" style="text-align:right;margin-left:auto">The Final Page →<b>Say them out loud</b></a>`}
      </nav>
    </div></article>`;
}

function viewCast(){
  return `<div class="view">${head('Seven people, one of them dead before it begins','The Characters','Nobody in this story explains themselves. You will have to watch their hands.')}
  <div class="wrap"><div class="cast">${CAST.map(p=>`
    <a class="who-card rise" href="#/characters/${p.id}"><div class="por">${EMBLEM[p.emblem]}</div>
    <h3>${p.name}</h3><p class="role">${p.role}</p></a>`).join('')}</div></div></div>`;
}

function viewPerson(id){
  const p=CAST.find(x=>x.id===id); if(!p)return viewCast();
  return `<article class="view"><div class="wrap">
    <div class="who-hero"><div class="por">${EMBLEM[p.emblem]}</div>
      <div><p class="eyebrow">${p.role}</p><h1 style="font-size:clamp(2rem,7vw,3.3rem);font-weight:300;letter-spacing:.04em">${p.name}</h1>
      <hr class="rule short"><p class="quoteline">${p.quote}</p><p class="attr">${p.attr}</p></div></div>
    <hr class="rule">
    <div class="narrow" style="margin:0 auto"><ul class="facts">${p.facts.map(([k,v])=>`<li class="rise"><b>${k}</b><span>${v}</span></li>`).join('')}</ul></div>
    <hr class="rule">
    <div class="narrow" style="margin:0 auto"><p class="eyebrow" style="text-align:center">Their things — open them</p>
    <div class="objects" id="objs">${p.objects.map((o,i)=>`
      <button class="obj" type="button" aria-expanded="false" data-i="${i}"><span class="lbl">${o[0]}</span><span class="nm">${o[1]}</span></button>
      <div class="obj-body" id="ob${i}"><div class="inner">${o[2]}</div></div>`).join('')}</div></div>
    <div class="narrow" style="margin:2.4rem auto 0"><div class="artnote"><h4>Artwork direction — character consistency</h4><p>${p.art}</p></div>
    <p style="text-align:center;margin-top:2.6rem"><a class="btn" href="#/characters">All characters</a></p></div>
  </div></article>`;
}

function viewKingdom(){
  const pins=PLACES.map(pl=>{
    const lock=progress()<pl.after;
    const ax=pl.ax||'middle';
    const tx=pl.x+(ax==='start'?11:ax==='end'?-11:0), ty=pl.y+(ax==='middle'?-13:3.2);
    return `<g class="pin" data-id="${pl.id}" data-locked="${lock}" tabindex="${lock?-1:0}" role="button" aria-label="${pl.name}">
      <circle class="halo" cx="${pl.x}" cy="${pl.y}" r="9"/>
      <circle class="dot" cx="${pl.x}" cy="${pl.y}" r="3.2"/>
      <text x="${tx}" y="${ty}" text-anchor="${ax}">${pl.name}</text></g>`;}).join('');
  let riv='';for(let i=0;i<3;i++)riv+=`<path d="M20 ${268+i*5}q140 -34 240 6t330 -74" fill="none" stroke="#26333e" stroke-width="${3.4-i}" opacity=".55"/>`;
  let trees='';for(let i=0;i<34;i++){const x=320+Math.random()*270,y=190+Math.random()*170;trees+=`<path d="M${x} ${y}l4 -9 4 9z" fill="none" stroke="#2e3a30" stroke-width=".7"/>`;}
  return `<div class="view">${head('Ground','The Kingdom','Locations open as you read. Everything on this map has been walked over by somebody in this story.')}
  <div class="wrap"><div class="mapwrap rise">
    <svg viewBox="0 0 600 380" role="img" aria-label="A map of the kingdom">
      <rect width="600" height="380" fill="#0c0f12"/>
      <g opacity=".5">${(()=>{let s='';for(let i=0;i<13;i++)s+=`<line x1="${i*50}" y1="0" x2="${i*50}" y2="380" stroke="#1a2028" stroke-width=".5"/>`;for(let i=0;i<9;i++)s+=`<line x1="0" y1="${i*48}" x2="600" y2="${i*48}" stroke="#1a2028" stroke-width=".5"/>`;return s;})()}</g>
      ${riv}${trees}
      <g opacity=".85"><rect x="58" y="100" width="238" height="248" rx="4" fill="rgba(233,223,203,.022)" stroke="#4a4032" stroke-width=".9" stroke-dasharray="3 4"/>
      <text x="58" y="92" fill="#8a7340" font-family="Georgia,serif" font-size="8.4" letter-spacing="4">RIVENELLE — THE HOUSE</text></g>
      <path d="M296 250q60 46 102 52t70 -64 54 -86" fill="none" stroke="#4a4032" stroke-width="1.3" stroke-dasharray="6 5" opacity=".85"/>
      <g opacity=".55"><path d="M566 330v-38M566 292l-6 8M566 292l6 8" stroke="#8a7340" stroke-width="1" fill="none"/><text x="566" y="344" text-anchor="middle" fill="#8a7340" font-family="Georgia,serif" font-size="9" letter-spacing="2">N</text></g>
      ${pins}
    </svg></div>
    <p style="text-align:center;margin-top:1rem;font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-dim)">${PLACES.filter(p=>progress()>=p.after).length} of ${PLACES.length} places open</p>

    <hr class="rule">
    <h2 style="text-align:center;font-size:clamp(1.5rem,5vw,2.2rem);font-weight:300;letter-spacing:.1em;text-transform:uppercase">The Garden</h2>
    <p style="text-align:center;color:var(--vellum-dim);font-style:italic;margin:.9rem 0 2rem">Eight paces by thirty. Touch a flower.</p>
    <div class="gardenbed rise">
      <svg viewBox="0 0 600 200" role="img" aria-label="Eight tulips in a row; select one to read its bed">
        ${GARDEN_MEMOS.map((m,i)=>`<g class="tulipbtn" data-i="${i}" tabindex="0" role="button" aria-label="${m[0]}">
          <rect x="${18+i*72}" y="20" width="64" height="170" fill="transparent"/>
          <line x1="${28+i*72}" y1="176" x2="${76+i*72}" y2="176" stroke="#8a7340" stroke-width=".7" opacity=".5"/>
          <g class="bloom">${(()=>{const cols=['#f2e8d6','#8f2733','#e9dfcb','#d9c3a4','#efe7d6','#c9a86a','#9c2c36','#ffffff'];return tulip(50+i*72,176,1.5,cols[i]);})()}</g></g>`).join('')}
      </svg>
      <div class="memo" id="memo"><span class="nm">The rows</span>Her mother taught her to walk them every April and say the names out loud, as a game, because she was six and there was no other way to make it stick.</div>
    </div>

    <hr class="rule">
    <h2 style="text-align:center;font-size:clamp(1.5rem,5vw,2.2rem);font-weight:300;letter-spacing:.1em;text-transform:uppercase">The Chronology</h2>
    <p style="text-align:center;color:var(--vellum-dim);font-style:italic;margin:.9rem 0 2.4rem">Some of it is still dark. It will come up as you read.</p>
    <div class="narrow" style="margin:0 auto"><ul class="tl">${TIMELINE.map(t=>{
      const lock=progress()<t.after;
      return `<li class="rise ${lock?'hidden-ev':''}"><span class="yr">${lock?'— — — —':t.yr}</span>
        <h4>${lock?'Not yet known':t.t}</h4><p>${lock?'This has not happened to you yet.':t.d}</p></li>`;}).join('')}</ul></div>
  </div></div>`;
}

function viewArchive(){
  const items=ARCHIVE.filter(a=>!a.secret||a.after===0);
  return `<div class="view">${head('Paper','The Archive','Eight documents and two that were not meant to be found. Everything here is quoted in full.')}
  <div class="wrap"><div class="letters">${items.map(a=>{
    const lock=progress()<a.after;
    return `<button class="letter rise" type="button" data-id="${a.id}" data-locked="${lock}" ${lock?'aria-disabled="true"':''}>
      <span class="fold"><span class="kind">${lock?'Sealed':a.kind}</span>
      <h3>${lock?'—':a.title}</h3>
      <span class="meta">${lock?'Read further to break this seal.':a.meta}</span>
      <span class="wax" aria-hidden="true"></span></span></button>`;}).join('')}</div>
    ${S.secrets.size<TOTAL_SECRETS?`<p style="text-align:center;margin-top:2.6rem;color:var(--vellum-dim);font-style:italic;font-size:.95rem">Two documents in this house are not listed anywhere. They are hidden in the story itself, behind the small ornaments between scenes. ${S.secrets.size} of ${TOTAL_SECRETS} found.</p>`:''}
  </div></div>`;
}

function viewGallery(){
  return `<div class="view">${head('Ten plates','The Gallery','Every image on this site is drawn in your browser in line and hatch — no photographs, no rasters, the way a florilegium was actually made. Each carries its artwork direction for a painter or a generator.')}
  <div class="wrap">${CHAPTERS.map((c,i)=>{
    const lock=progress()<i+1;
    return `<figure class="plate rise"><div class="frame">${lock?`<svg viewBox="0 0 600 380" role="img" aria-label="Sealed plate"><rect width="600" height="380" fill="#111"/><text x="300" y="196" text-anchor="middle" fill="#3d3931" font-family="Georgia,serif" font-size="15" letter-spacing="6">SEALED</text></svg>`:ART[c.plate]()}</div>
      <figcaption>${lock?'Plate '+c.num+' — sealed':c.plateCap}<i>${lock?'Read Part '+c.num:c.plateSub}</i></figcaption>
      ${lock?'':`<div class="artnote" style="text-align:left"><h4>Direction</h4><p>${c.art}</p></div>`}</figure>`;}).join('')}
  </div></div>`;
}

function viewPoems(){
  return `<div class="view">${head('The April book','The Poems','Small, brown, unremarkable. One page a year since she was fourteen, and considerably more in 1750. Nobody ever read it. You are reading it.')}
  <div class="wrap"><div class="poemlist">${CHAPTERS.map((c,i)=>{
    const lock=!S.read.has(c.id);
    return `<div class="poemcard rise ${lock?'locked':''}"><p class="src">${c.poem.title} · ${c.poem.cap}</p>
    <p class="verse">${lock?'Read this part before the page will open. It is her handwriting and it is not very good.':c.poem.verse}</p></div>`;}).join('')}</div></div></div>`;
}

function viewFinal(){
  if(!done())return `<div class="view">${head('Sealed','The Final Page','This page opens when all ten parts have been read. There is no eleventh part; there is only this.')}
    <p style="text-align:center"><a class="btn" href="#/story">Return to the story</a></p></div>`;
  return `<div class="view">${head('12 April, every year','Say Them Out Loud','“It is not a game, and I am sorry to have taught it to you as one, but you were six and I had no other way to make it stick.”')}
  <div class="wrap">
    <div class="narrow" style="margin:0 auto 2.4rem"><p style="text-align:center;color:var(--vellum-2);font-style:italic">Forty-one people were taken out of the villages of the Aine in the winter of 1731 for counting the grain in a year of famine and writing the number down. A queen who could not save them bought them names and put the names into the flower trade of Europe, where there is no censor and no bonfire big enough.</p>
    <p style="text-align:center;color:var(--vellum-2);font-style:italic;margin-top:1.2rem">The list below is the whole of it. Touch each name. That is the entire ritual; there was never any more to it than that.</p></div>
    <p class="rollcount" id="rollcount">0 of 41 said</p>
    <div class="roll" id="roll">${ROLL.map((r,i)=>`<button class="name" type="button" data-i="${i}">${r[0]}<small>${r[1]} · taken ${r[2]}</small></button>`).join('')}</div>
    <div id="rollEnd" class="narrow" style="margin:3rem auto 0;text-align:center">
      <div style="width:120px;margin:0 auto 2rem">${EMBLEM.tulip}</div>
      <p style="font-family:var(--ff-display);font-style:italic;font-size:clamp(1.1rem,3.4vw,1.5rem);line-height:1.7;color:var(--vellum);white-space:pre-line">In the registration book of the tulip growers at Haarlem, under the year 1751:

<b style="font-weight:400;color:var(--gold-glow)">603. ‘Catherine Anne’ — white, single, late.</b>
Introduced by J. Sevin, of France.
<i>The introducer will accept no premium, and desires that it be
offered at one sou the bulb, any quantity, in perpetuity.</i></p>
      <hr class="rule">
      <p style="color:var(--vellum-2);line-height:1.9">He did not make her rare. Anybody can make a woman rare; that is what a crown is for.<br>He made her <i>common</i> — window boxes, churchyards, the strip of dirt outside a tavern —<br>at one sou the bulb, any quantity, for the rest of his life.</p>
      <p style="color:var(--vellum-2);line-height:1.9;margin-top:1.6rem">It is not rare. It is not fine. It is not worth anything at all,<br>and it comes back every single year without being asked.</p>
      <p style="font-family:var(--ff-display);font-style:italic;font-size:clamp(1.3rem,4.6vw,2rem);color:var(--gold-glow);margin:2.8rem 0 1rem">You have almost certainly walked past her.</p>
      <p class="eyebrow" style="margin-top:2.4rem">There is no eleventh part</p>
      <p><a class="btn" href="#/story/part-1">Read Part I again — it is a different book now</a></p>
    </div>
  </div></div>`;
}

/* ─── router ──────────────────────────────────────────────────── */
function route(){
  const h=(location.hash||'#/').replace(/^#/,'');
  const p=h.split('/').filter(Boolean);
  let html='', scene='night';
  if(p[0]==='story'&&p[1]){html=viewChapter(p[1]); scene=sceneFor(p[1]);}
  else if(p[0]==='characters'&&p[1])html=viewPerson(p[1]);
  else if(p[0]==='characters')html=viewCast();
  else if(p[0]==='kingdom'){html=viewKingdom(); scene='garden';}
  else if(p[0]==='archive')html=viewArchive();
  else if(p[0]==='gallery')html=viewGallery();
  else if(p[0]==='poems')html=viewPoems();
  else if(p[0]==='final'){html=viewFinal(); scene='hall';}
  else html=viewStory();
  if(!html)return;
  const v=$('#view'); v.innerHTML=html; window.scrollTo(0,0); if(S.entered)v.focus({preventScroll:true});
  setScene(scene); wire(p); observe(); renderMenu();
  document.title=titleFor(p)+' — The Tulip & The Jester';
}
function titleFor(p){
  if(p[0]==='story'&&p[1]){const c=chById(p[1]);return c?`Part ${c.num}: ${c.title}`:'The Story';}
  if(p[0]==='characters'&&p[1]){const c=CAST.find(x=>x.id===p[1]);return c?c.name:'The Characters';}
  const m={characters:'The Characters',kingdom:'The Kingdom',archive:'The Archive',gallery:'The Gallery',poems:'The Poems',final:'The Final Page'};
  return m[p[0]]||'The Story';
}
function sceneFor(id){return ({'part-1':'hall','part-4':'hall','part-10':'hall','part-3':'garden','part-5':'rain','part-6':'garden','part-8':'winter'})[id]||'night';}

/* ─── wiring per view ─────────────────────────────────────────── */
function wire(p){
  const ra=$('#readAll');
  if(ra)ra.addEventListener('click',()=>{CHAPTERS.forEach(c=>S.read.add(c.id));document.dispatchEvent(new CustomEvent('sf:read-all',{detail:{}}));toast('The house is open.');route();});

  if(p[0]==='story'&&p[1]){
    const c=chById(p[1]);
    if(c){ if(!S.read.has(c.id)) setTimeout(()=>{S.read.add(c.id);renderMenu();document.dispatchEvent(new CustomEvent('sf:read',{detail:{id:c.id}})); if(done())toast('All ten parts read — the final page is unsealed.');},2600); }
    $$('#view .beat').forEach((b,i)=>{
      b.setAttribute('role','button'); b.setAttribute('tabindex','0');
      b.setAttribute('aria-label','Ornament'); b.style.cursor='pointer';
      const key=p[1]+':'+i;
      const act=()=>{ petalBurst(b); if(SECRETS[key])findSecret(key); };
      b.addEventListener('click',act);
      b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
    });
  }

  const objs=$('#objs');
  if(objs)$$('.obj',objs).forEach(b=>b.addEventListener('click',()=>{
    const body=$('#ob'+b.dataset.i), open=b.getAttribute('aria-expanded')==='true';
    b.setAttribute('aria-expanded',String(!open)); body.classList.toggle('open',!open);
  }));

  $$('#view .pin').forEach(g=>{
    const act=()=>{const pl=PLACES.find(x=>x.id===g.dataset.id);
      openModal('Place',pl.name,pl.chs?('Appears in Parts '+pl.chs):'',pl.desc+'\n\n<i>'+pl.memo+'</i>\n\n<b style="font-weight:400">'+pl.who+'</b>','');};
    g.addEventListener('click',act);
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
  });

  $$('#view .tulipbtn').forEach(g=>{
    const show=()=>{const m=GARDEN_MEMOS[+g.dataset.i];const el=$('#memo');
      if(el){el.style.opacity=0;setTimeout(()=>{el.innerHTML=`<span class="nm">${m[0]}</span>${m[1]}`;el.style.opacity=1;},180);}
      if(+g.dataset.i===7)findSecret('garden:41');};
    g.addEventListener('mouseenter',show); g.addEventListener('focus',show);
    g.addEventListener('click',show);
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
  });

  $$('#view .letter').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.locked==='true'){toast('Sealed — read further');return;}
    const a=ARCHIVE.find(x=>x.id===b.dataset.id); openModal(a.kind,a.title,a.meta,a.body,a.sign);
  }));

  const roll=$('#roll');
  if(roll)$$('.name',roll).forEach(b=>b.addEventListener('click',()=>{
    if(b.classList.contains('said'))return;
    b.classList.add('said'); S.said.add(b.dataset.i);
    $('#rollcount').textContent=S.said.size+' of 41 said';
    if(S.said.size===41){ document.dispatchEvent(new CustomEvent('sf:roll-complete',{detail:{}})); $('#rollEnd').classList.add('on');
      setTimeout(()=>$('#rollEnd').scrollIntoView({behavior:S.motion?'smooth':'auto',block:'start'}),700); }
  }));
}

/* ─── reveal on scroll ────────────────────────────────────────── */
let io;
function observe(){
  if(io)io.disconnect();
  if(!S.motion){$$('.rise').forEach(e=>e.classList.add('in'));return;}
  io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});
  $$('.rise').forEach(e=>io.observe(e));
}

/* ─── scene tinting ───────────────────────────────────────────── */
const SCENES={
 night:['radial-gradient(60% 45% at 50% 8%,rgba(246,207,148,.08),transparent 70%)',400,.35],
 hall:['radial-gradient(70% 50% at 50% 6%,rgba(246,207,148,.16),transparent 72%)',900,.5],
 garden:['radial-gradient(70% 55% at 50% 14%,rgba(120,180,120,.07),transparent 72%)',700,.3],
 rain:['radial-gradient(80% 60% at 50% 4%,rgba(150,180,210,.09),transparent 74%)',500,.55],
 winter:['radial-gradient(80% 60% at 50% 10%,rgba(200,215,230,.07),transparent 74%)',300,.2]
};
let scene='night';
function setScene(s){scene=SCENES[s]?s:'night'; $('#warm').style.background=SCENES[scene][0]; if(audio.on)audio.tune();}

/* ─── particles ───────────────────────────────────────────────── */
const cv=$('#particles'), cx=cv.getContext('2d');
let W=0,H=0,parts=[],raf=null;
function size(){W=cv.width=innerWidth*Math.min(devicePixelRatio,2);H=cv.height=innerHeight*Math.min(devicePixelRatio,2);cv.style.width=innerWidth+'px';cv.style.height=innerHeight+'px';}
function seed(){
  parts=[];const n=Math.min(46,Math.round(innerWidth/26));
  for(let i=0;i<n;i++)parts.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2.6+.5,vx:(Math.random()-.5)*.16,vy:Math.random()*.22+.05,a:Math.random()*.5+.12,ph:Math.random()*6.3,pet:Math.random()<.28});
}
function tick(){
  cx.clearRect(0,0,W,H);
  const rain=scene==='rain';
  for(const p of parts){
    p.ph+=.011; p.x+=p.vx+Math.sin(p.ph)*.22; p.y+=p.vy*(p.pet?1.6:1);
    if(p.y>H+10){p.y=-10;p.x=Math.random()*W;} if(p.x<-10)p.x=W+10; if(p.x>W+10)p.x=-10;
    if(p.pet){cx.save();cx.translate(p.x,p.y);cx.rotate(p.ph);cx.globalAlpha=p.a*.8;cx.fillStyle=scene==='winter'?'#dfe6ee':'#e6d3c2';
      cx.beginPath();cx.ellipse(0,0,p.r*2.6,p.r*1.1,0,0,6.3);cx.fill();cx.restore();}
    else{cx.globalAlpha=p.a*.55;cx.fillStyle=scene==='garden'?'#cfe0c2':'#f4e2c4';cx.beginPath();cx.arc(p.x,p.y,p.r*.9,0,6.3);cx.fill();}
  }
  if(rain){cx.globalAlpha=.13;cx.strokeStyle='#9fb6c9';cx.lineWidth=1;
    for(let i=0;i<60;i++){const x=(i*137+performance.now()*.09)%W,y=(i*211+performance.now()*.55)%H;
      cx.beginPath();cx.moveTo(x,y);cx.lineTo(x-6,y+22);cx.stroke();}}
  cx.globalAlpha=1; raf=requestAnimationFrame(tick);
}
function startParticles(){if(!S.motion){cancelAnimationFrame(raf);cx.clearRect(0,0,W,H);return;}if(!raf)raf=requestAnimationFrame(tick);}
function petalBurst(el){
  if(!S.motion)return;
  const r=el.getBoundingClientRect(), d=Math.min(devicePixelRatio,2);
  for(let i=0;i<14;i++)parts.push({x:(r.left+r.width/2)*d,y:(r.top+r.height/2)*d,r:Math.random()*2.4+1,vx:(Math.random()-.5)*1.6,vy:Math.random()*.7+.1,a:.7,ph:Math.random()*6.3,pet:true});
  if(parts.length>140)parts.splice(0,parts.length-140);
}
addEventListener('resize',()=>{size();seed();},{passive:true});
size();seed();

/* ─── sound: everything synthesised, nothing downloaded ───────── */
const audio={ctx:null,on:false,nodes:null,timer:null,
  build(){
    const C=window.AudioContext||window.webkitAudioContext; if(!C)return false;
    const ctx=this.ctx=new C();
    const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
    const len=ctx.sampleRate*4, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
    let last=0; for(let i=0;i<len;i++){const w=Math.random()*2-1; last=(last+.02*w)/1.02; d[i]=last*3.2;}
    const noise=ctx.createBufferSource(); noise.buffer=buf; noise.loop=true;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.Q.value=.4;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=90;
    const ng=ctx.createGain(); ng.gain.value=.34;
    noise.connect(hp).connect(lp).connect(ng).connect(master); noise.start();
    const lfo=ctx.createOscillator(); lfo.frequency.value=.06;
    const lg=ctx.createGain(); lg.gain.value=90; lfo.connect(lg).connect(lp.frequency); lfo.start();
    const drone=ctx.createOscillator(); drone.type='sine'; drone.frequency.value=55;
    const dg=ctx.createGain(); dg.gain.value=.045; drone.connect(dg).connect(master); drone.start();
    this.nodes={master,lp,ng,dg}; return true;
  },
  note(){
    if(!this.ctx||!this.on)return;
    const ctx=this.ctx, t=ctx.currentTime;
    const scale=[220,246.94,261.63,293.66,329.63,392,440,523.25];
    const f=scale[Math.floor(Math.random()*scale.length)]*(Math.random()<.3?2:1);
    const o=ctx.createOscillator(), g=ctx.createGain(), lp=ctx.createBiquadFilter();
    o.type='triangle'; o.frequency.value=f; lp.type='lowpass'; lp.frequency.value=1400;
    const peak=scene==='hall'?.05:.028;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+.06);
    g.gain.exponentialRampToValueAtTime(.0001,t+3.4);
    o.connect(lp).connect(g).connect(this.nodes.master); o.start(t); o.stop(t+3.6);
  },
  tune(){
    if(!this.ctx)return; const t=this.ctx.currentTime, n=this.nodes;
    const cfg={night:[420,.30,.045],hall:[900,.18,.06],garden:[700,.20,.03],rain:[1500,.55,.03],winter:[300,.14,.05]}[scene];
    n.lp.frequency.setTargetAtTime(cfg[0],t,1.4);
    n.ng.gain.setTargetAtTime(cfg[1],t,1.4);
    n.dg.gain.setTargetAtTime(cfg[2],t,1.4);
  },
  toggle(){
    if(!this.ctx&&!this.build()){toast('Sound not available here');return;}
    this.on=!this.on;
    if(this.ctx.state==='suspended')this.ctx.resume();
    const t=this.ctx.currentTime;
    this.nodes.master.gain.setTargetAtTime(this.on?.5:0,t,.9);
    this.tune();
    clearInterval(this.timer);
    if(this.on)this.timer=setInterval(()=>{if(Math.random()<.55)this.note();},2600);
    const b=$('#soundBtn'); b.setAttribute('aria-pressed',String(this.on));
    $('#mute').style.display=this.on?'none':'block';
    $('#wave1').style.opacity=this.on?1:.25; $('#wave2').style.opacity=this.on?1:.25;
    toast(this.on?'Sound on — rain, and a room somewhere below':'Sound off');
  }
};
$('#soundBtn').addEventListener('click',()=>audio.toggle());
$('#mute').style.display='block'; $('#wave1').style.opacity=.25; $('#wave2').style.opacity=.25;

$('#motionBtn').addEventListener('click',()=>{
  S.motion=!S.motion;
  document.documentElement.dataset.motion=S.motion?'on':'off';
  $('#motionBtn').setAttribute('aria-pressed',String(S.motion));
  startParticles(); observe();
  toast(S.motion?'Animation on':'Animation off — nothing is lost');
});
if(reduced){S.motion=false;document.documentElement.dataset.motion='off';$('#motionBtn').setAttribute('aria-pressed','false');}

/* ─── reading progress bar ────────────────────────────────────── */
addEventListener('scroll',()=>{
  const h=document.documentElement.scrollHeight-innerHeight;
  $('#progress').style.width=(h>60?Math.min(100,(scrollY/h)*100):0)+'%';
  const c=$('#chrome'); if(scrollY>240&&!$('#menu').classList.contains('open'))c.classList.toggle('hide',scrollY>lastY&&scrollY>380); else c.classList.remove('hide');
  lastY=scrollY;
},{passive:true});
let lastY=0;

/* ─── threshold ───────────────────────────────────────────────── */
$('#candle').addEventListener('click',()=>{
  S.candle++; petalBurst($('#candle'));
  if(S.candle>=3)findSecret('candle');
});
function reveal(){
  $('#view').removeAttribute('aria-hidden');
  $('footer.site').removeAttribute('aria-hidden');
  $('#chrome').hidden=false;
}
function enter(){
  if(S.entered)return; S.entered=true;
  const t=$('#threshold'); t.classList.add('leaving');
  setTimeout(()=>{t.hidden=true;},1600);
  reveal();
  if(!location.hash||location.hash==='#/')location.hash='#/story';
  else route();
  startParticles();
}
$('#enterBtn').addEventListener('click',enter);
$('#threshold').addEventListener('keydown',e=>{if(e.key==='Enter')enter();});

document.addEventListener('sf:prefs', (e) => {
  const p = e.detail || {};
  const on = p.motion === 'full';
  S.motion = on;
  document.documentElement.dataset.motion = on ? 'on' : 'off';
  const btn = $('#motionBtn'); if (btn) btn.setAttribute('aria-pressed', String(on));
  startParticles(); observe();
});
addEventListener('hashchange',route);
renderMenu();
if(location.hash&&location.hash!=='#/'){ $('#threshold').hidden=true; S.entered=true; reveal(); startParticles(); route(); }
else { route(); }
};
if (!window.__SF_DEFER__) window.__START_APP__();
</script>
</body>
</html>
