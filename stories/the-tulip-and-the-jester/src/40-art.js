<script>
/* ══════════════════════════════════════════════════════════════════
   PLATES — every image in this site is drawn in the browser.
   No photographs, no rasters, no external assets: engraved line-work,
   the way a florilegium was actually made.
   ══════════════════════════════════════════════════════════════════ */
const G='#c2a15f', GD='#8a7340', V='#e9dfcb', VD='#a89b81', DK='#141a24';

function defs(id){return `<defs>
<linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101620"/><stop offset="1" stop-color="#05070a"/></linearGradient>
<linearGradient id="warm${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cf94" stop-opacity=".45"/><stop offset="1" stop-color="#f6cf94" stop-opacity="0"/></linearGradient>
<pattern id="hatch${id}" width="6" height="6" patternTransform="rotate(38)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="${GD}" stroke-width=".7" opacity=".5"/></pattern>
<pattern id="hatch2${id}" width="4" height="4" patternTransform="rotate(-40)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="${VD}" stroke-width=".5" opacity=".35"/></pattern>
<radialGradient id="glow${id}"><stop offset="0" stop-color="#f6cf94" stop-opacity=".55"/><stop offset="1" stop-color="#f6cf94" stop-opacity="0"/></radialGradient>
</defs>`;}

/* a single tulip, drawn once, reused everywhere */
function tulip(x,y,s,c,leaf){
  c=c||V; leaf=leaf===false?false:true;
  return `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 0V-26" stroke="#5f6b4e" stroke-width="1.4" fill="none"/>
  ${leaf?`<path d="M0 -6c-5-2-8-8-9-14 5 1 8 6 9 14z" fill="#41503a"/><path d="M0 -14c4-2 7-7 8-12-4 1-7 5-8 12z" fill="#4c5c42"/>`:''}
  <path d="M0 -25c-4.4 0-7.4-3-8.4-8-.7-3.7 0-8 1-11 1.7 2.7 3 5.7 3.7 8.7.7-5.4 2.4-10 3.7-12.7 1.3 2.7 3 7.3 3.7 12.7.7-3 2-6 3.7-8.7 1 3 1.7 7.3 1 11-1 5-4 8-8.4 8z" fill="${c}"/>
  <path d="M0 -25c-2 0-3-3.4-3.4-9.4-.3-4.4 1.4-10.4 3.4-13.7 2 3.3 3.7 9.3 3.4 13.7C3 -28.4 2 -25 0 -25z" fill="#fff" opacity=".22"/>
  </g>`;
}

const ART = {

ballroom(){const id='b';let c='';
  for(let i=0;i<7;i++){const x=60+i*82;c+=`<g opacity=".9"><line x1="${x}" y1="0" x2="${x}" y2="${58+(i%2)*14}" stroke="${GD}" stroke-width=".6"/><ellipse cx="${x}" cy="${62+(i%2)*14}" rx="26" ry="6" fill="none" stroke="${GD}" stroke-width="1"/>`;
    for(let k=0;k<7;k++){const cx=x-24+k*8;c+=`<line x1="${cx}" y1="${56+(i%2)*14}" x2="${cx}" y2="${62+(i%2)*14}" stroke="${V}" stroke-width="1.4" opacity=".8"/><circle cx="${cx}" cy="${54+(i%2)*14}" r="2.6" fill="url(#glow${id})"/><circle cx="${cx}" cy="${54.5+(i%2)*14}" r="1" fill="#f6cf94"/>`;}
    c+=`</g>`;}
  let f='';for(let i=0;i<13;i++){const x=i*46;f+=`<line x1="${x}" y1="248" x2="${300+(x-300)*2.6}" y2="380" stroke="${GD}" stroke-width=".45" opacity=".45"/>`;}
  for(let i=1;i<7;i++){const y=248+i*i*3.4;f+=`<line x1="0" y1="${y}" x2="600" y2="${y}" stroke="${GD}" stroke-width=".45" opacity=".4"/>`;}
  let w='';for(let i=0;i<4;i++){const x=150+i*100;w+=`<path d="M${x} 232V150a26 26 0 0 1 52 0v82z" fill="url(#sky${id})" stroke="${GD}" stroke-width=".8"/><line x1="${x+26}" y1="128" x2="${x+26}" y2="232" stroke="${GD}" stroke-width=".4" opacity=".6"/>`;
    for(let r=0;r<9;r++){const rx=x+4+r*5.6;w+=`<line x1="${rx}" y1="${150+r*4}" x2="${rx-7}" y2="${226}" stroke="#9fb6c9" stroke-width=".5" opacity=".35"/>`;}}
  let p='';[[92,232],[508,232]].forEach(([x,y])=>{p+=`<rect x="${x-13}" y="${y-104}" width="26" height="104" fill="none" stroke="${GD}" stroke-width=".7"/><rect x="${x-17}" y="${y-4}" width="34" height="8" fill="none" stroke="${GD}" stroke-width=".7"/>`;});
  let fig='';const F=[[210,244,.42],[248,246,.4],[352,245,.41],[392,243,.39],[300,250,.62],[276,251,.6]];
  F.forEach(([x,y,s],i)=>{const sol=i>3;fig+=`<g opacity="${sol?'1':'.5'}" transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-34" r="6.6" fill="${sol?V:VD}"/><path d="M0 -28c-9 0-13 8-14 18-1 9-2 10-2 10h32s-1-1-2-10c-1-10-5-18-14-18z" fill="${sol?V:VD}"/></g>`;});
  return `<svg viewBox="0 0 600 380" role="img" aria-label="The Long Hall by candlelight, rain on the far windows">${defs(id)}
  <rect width="600" height="380" fill="#0b0d12"/>
  <rect y="230" width="600" height="150" fill="#0e1116"/>
  ${w}${p}${f}
  <rect width="600" height="150" fill="url(#warm${id})" opacity=".5"/>
  ${c}${fig}
  <line x1="0" y1="232" x2="600" y2="232" stroke="${GD}" stroke-width=".8" opacity=".7"/>
  </svg>`;},

palace(){const id='p';let win='';
  for(let i=0;i<9;i++){const x=196+i*24;const lit=i>2&&i<6;win+=`<rect x="${x}" y="196" width="12" height="20" fill="${lit?'#f6cf94':'#151a20'}" opacity="${lit?'.85':'1'}"/><rect x="${x}" y="224" width="12" height="18" fill="${lit?'#e8c489':'#141920'}" opacity="${lit?'.6':'1'}"/>`;}
  for(let i=0;i<7;i++){const x=52+i*20;win+=`<rect x="${x}" y="210" width="10" height="16" fill="#131820"/><rect x="${x}" y="232" width="10" height="14" fill="#131820"/>`;}
  for(let i=0;i<7;i++){const x=430+i*20;win+=`<rect x="${x}" y="210" width="10" height="16" fill="#131820"/><rect x="${x}" y="232" width="10" height="14" fill="#131820"/>`;}
  let ref='';for(let i=0;i<26;i++){const y=286+i*3.4;ref+=`<line x1="${40+Math.sin(i)*14}" y1="${y}" x2="${560-Math.cos(i)*18}" y2="${y}" stroke="#243040" stroke-width=".8" opacity="${.5-i*.014}"/>`;}
  return `<svg viewBox="0 0 600 380" role="img" aria-label="Rivenelle seen at dusk from across the river">${defs(id)}
  <rect width="600" height="380" fill="url(#skyp)"/>
  <ellipse cx="300" cy="270" rx="330" ry="70" fill="#f6cf94" opacity=".05"/>
  <path d="M0 268h600v112H0z" fill="#0a0d12"/>
  <g stroke="${GD}" stroke-width=".8" fill="#101620">
    <path d="M44 268V200h124v68z"/><path d="M432 268V200h124v68z"/>
    <path d="M188 268V182h224v86z"/>
    <path d="M188 182l112-38 112 38z"/>
    <path d="M44 200l62-22 62 22z"/><path d="M432 200l62-22 62 22z"/>
  </g>
  ${win}
  <g stroke="${GD}" stroke-width=".6" opacity=".7" fill="none"><line x1="188" y1="182" x2="412" y2="182"/><line x1="44" y1="200" x2="168" y2="200"/><line x1="432" y1="200" x2="556" y2="200"/><line x1="0" y1="268" x2="600" y2="268"/></g>
  <g stroke="${GD}" stroke-width=".5" opacity=".45" fill="none"><path d="M60 288h480M110 300h380M160 314h280M210 330h180"/></g>
  ${ref}
  <circle cx="300" cy="152" r="3" fill="#f6cf94" opacity=".8"/>
  </svg>`;},

garden(after){const id='g';const bare=!!after;let beds='';
  for(let r=0;r<9;r++){
    const y=190+r*20+r*r*1.4, x0=300-(64+r*30), x1=300+(64+r*30), s=.42+r*.09;
    beds+=`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${GD}" stroke-width=".6" opacity=".55"/>`;
    if(!bare){const n=4+r;for(let i=0;i<n;i++){const x=x0+18+(x1-x0-36)*(i/(n-1||1));
      const cols=[V,'#f2e8d6','#d9c3a4','#8f2733','#c9a86a','#efe7d6'];
      beds+=tulip(x,y,s,cols[(r*3+i)%cols.length]);}}
    else{for(let i=0;i<10;i++){const x=x0+8+(x1-x0-16)*(i/9);beds+=`<line x1="${x}" y1="${y-3}" x2="${x+4}" y2="${y}" stroke="#7d7a72" stroke-width=".5" opacity=".5"/>`;}}
  }
  return `<svg viewBox="0 0 600 380" role="img" aria-label="${bare?'The walled garden after the beds were turned and limed':'The walled garden, forty-one beds in rows'}">${defs(id)}
  <rect width="600" height="380" fill="${bare?'#171a1c':'#131a16'}"/>
  <rect width="600" height="176" fill="${bare?'#20242a':'#2a2318'}" opacity=".9"/>
  <g opacity="${bare?'.5':'.75'}">${(()=>{let b='';for(let r=0;r<11;r++)for(let c2=0;c2<26;c2++){const x=c2*24+(r%2?12:0),y=r*16;b+=`<rect x="${x}" y="${y}" width="22" height="14" fill="none" stroke="${bare?'#4a4f55':'#6b543a'}" stroke-width=".4"/>`;}return b;})()}</g>
  <rect y="176" width="600" height="204" fill="${bare?'#2b2a26':'#241f16'}"/>
  ${bare?`<rect y="176" width="600" height="204" fill="#cfcabc" opacity=".14"/>`:''}
  <rect x="262" y="86" width="46" height="90" fill="${bare?'#0e1012':'#1e2b22'}" stroke="${GD}" stroke-width=".8"/>
  <line x1="285" y1="86" x2="285" y2="176" stroke="${GD}" stroke-width=".4" opacity=".6"/>
  ${beds}
  <g stroke="${GD}" stroke-width=".8" fill="none" opacity=".8"><path d="M436 300h84M442 300v22M514 300v22M436 292h84v8h-84z"/></g>
  ${bare?`<path d="M436 288h84v6h-84z" fill="#e9e6dc" opacity=".7"/>`:''}
  <rect width="600" height="380" fill="url(#warmg)" opacity="${bare?'.05':'.22'}"/>
  </svg>`;},

mask(){const id='m';
  let h='';for(let i=0;i<40;i++){const y=140+i*4;h+=`<line x1="${150+Math.sin(i/4)*10}" y1="${y}" x2="${450-Math.cos(i/5)*10}" y2="${y}" stroke="${GD}" stroke-width=".35" opacity=".18"/>`;}
  let crowd='';for(let i=0;i<34;i++){const x=20+(i%17)*35+(i>16?18:0), y=300+(i>16?34:0);crowd+=`<circle cx="${x}" cy="${y}" r="${i>16?12:10}" fill="none" stroke="${VD}" stroke-width=".6" opacity="${i>16?.28:.42}"/><path d="M${x-5} ${y-2}h10M${x-4} ${y+4}q4 3 8 0" stroke="${VD}" stroke-width=".5" fill="none" opacity="${i>16?.2:.3}"/>`;}
  return `<svg viewBox="0 0 600 380" role="img" aria-label="A black silk domino mask held up in candlelight, a masked crowd behind">${defs(id)}
  <rect width="600" height="380" fill="#0c0a0c"/>${h}${crowd}
  <ellipse cx="300" cy="176" rx="180" ry="96" fill="url(#glowm)" opacity=".35"/>
  <path d="M140 150c40-26 100-34 160-34s120 8 160 34c6 40-10 76-40 86-26 9-52-4-66-20-12-14-20-18-54-18s-42 4-54 18c-14 16-40 29-66 20-30-10-46-46-40-86z" fill="#16121a" stroke="${G}" stroke-width="1.2"/>
  <ellipse cx="212" cy="176" rx="40" ry="26" fill="#05050a"/><ellipse cx="388" cy="176" rx="40" ry="26" fill="#05050a"/>
  <path d="M140 150c40-26 100-34 160-34s120 8 160 34" fill="none" stroke="${V}" stroke-width=".8" opacity=".5"/>
  <path d="M300 194v22" stroke="${G}" stroke-width=".8" opacity=".6"/>
  <g fill="${V}" opacity=".85">${[[168,232],[196,244],[404,244],[432,232]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</g>
  <path d="M164 236q136 60 272 0" stroke="${G}" stroke-width=".6" fill="none" opacity=".5"/>
  <path d="M300 262q-8 40-34 54" stroke="${V}" stroke-width="1.6" fill="none" opacity=".65"/>
  <path d="M266 316c-8 6-16 8-24 6" stroke="${V}" stroke-width="1.6" fill="none" opacity=".65"/>
  </svg>`;},

village(){const id='v';
  let roofs='';const R=[[20,236,90,44],[104,222,74,58],[172,244,64,36],[230,214,86,66],[310,238,70,42],[374,206,78,74],[446,240,72,40],[512,226,76,54]];
  R.forEach(([x,y,w,h],i)=>{roofs+=`<path d="M${x} ${y}h${w}v${h}h-${w}z" fill="#181513" stroke="${GD}" stroke-width=".6"/><path d="M${x-6} ${y}l${w/2+6} -22 ${w/2+6} 22z" fill="#221c18" stroke="${GD}" stroke-width=".6"/>`;
    if(i%2)roofs+=`<rect x="${x+w/2-7}" y="${y+12}" width="14" height="16" fill="#f6cf94" opacity=".7"/>`;});
  let rain='';for(let i=0;i<130;i++){const x=Math.random()*620-10,y=Math.random()*300;rain+=`<line x1="${x}" y1="${y}" x2="${x-5}" y2="${y+17}" stroke="#8fa3b5" stroke-width=".5" opacity="${.1+Math.random()*.2}"/>`;}
  let wet='';for(let i=0;i<20;i++){wet+=`<line x1="${30+i*29}" y1="${312+i%3*8}" x2="${44+i*29}" y2="${312+i%3*8}" stroke="#f6cf94" stroke-width="1.6" opacity=".18"/>`;}
  return `<svg viewBox="0 0 600 380" role="img" aria-label="Cheneuil on market day in the rain">${defs(id)}
  <rect width="600" height="380" fill="#0e0f10"/>
  <rect y="196" width="600" height="184" fill="#131211"/>
  <path d="M406 206V128l16-26 16 26v78z" fill="#1a1512" stroke="${GD}" stroke-width=".6"/>
  <path d="M414 100l8-26 8 26" fill="none" stroke="${GD}" stroke-width=".7"/>
  <line x1="422" y1="74" x2="426" y2="52" stroke="${GD}" stroke-width=".7"/>
  ${roofs}
  <path d="M0 300h600v80H0z" fill="#17181a"/>
  <g opacity=".55">${(()=>{let s='';for(let r=0;r<7;r++)for(let c2=0;c2<22;c2++){s+=`<ellipse cx="${c2*28+(r%2?14:0)}" cy="${310+r*11}" rx="12" ry="4.5" fill="none" stroke="#3a3b3d" stroke-width=".45"/>`;}return s;})()}</g>
  ${wet}
  <g fill="#0f0e0d" opacity=".9">${[[150,300,.9],[186,304,.8],[352,302,.85]].map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-44" r="9" fill="#1b1a19"/><path d="M0 -36c-14 0-19 14-20 26-1 8-2 10-2 10h44s-1-2-2-10c-1-12-6-26-20-26z" fill="#1b1a19"/></g>`).join('')}</g>
  <g transform="translate(258 296)"><rect x="-30" y="-22" width="60" height="18" fill="#201a14" stroke="${GD}" stroke-width=".6"/><circle cx="-18" cy="0" r="9" fill="none" stroke="${GD}" stroke-width=".9"/><circle cx="18" cy="0" r="9" fill="none" stroke="${GD}" stroke-width=".9"/></g>
  ${rain}
  <rect width="600" height="380" fill="url(#warmv)" opacity=".1"/>
  </svg>`;},

letter(){const id='l';let lines='';
  for(let i=0;i<15;i++){const w=i===14?120:(300+Math.sin(i*1.7)*70);lines+=`<line x1="176" y1="${118+i*15}" x2="${176+w}" y2="${118+i*15}" stroke="#4c3f2e" stroke-width="${i===14?1.4:1}" opacity="${i===14?.9:.55}"/>`;}
  let bulbs='';[[92,318,1],[132,330,.86],[64,338,.72]].forEach(([x,y,s])=>{bulbs+=`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0c-16 0-26-12-26-28S-14-56 0-56s26 12 26 28S16 0 0 0z" fill="#7d5a37" stroke="#3d2c1a" stroke-width=".8"/><path d="M0 -56c-4 6-6 14-6 22M0 -56c4 6 6 14 6 22" stroke="#5c4327" stroke-width=".7" fill="none"/><path d="M0 0v10" stroke="#3d2c1a" stroke-width="1"/></g>`;});
  return `<svg viewBox="0 0 600 380" role="img" aria-label="An unfolded letter on bare earth beside a trowel and three tulip bulbs">${defs(id)}
  <rect width="600" height="380" fill="#100e0c"/>
  <rect y="0" width="600" height="380" fill="#171310"/>
  <g opacity=".5">${(()=>{let s='';for(let i=0;i<200;i++){const x=Math.random()*600,y=Math.random()*380;s+=`<circle cx="${x}" cy="${y}" r="${Math.random()*2.4}" fill="#2a2119" opacity=".7"/>`;}return s;})()}</g>
  <g transform="rotate(-2 340 200)">
  <path d="M160 62h380v280H160z" fill="#e5dbc4"/>
  <path d="M160 62h380v280H160z" fill="none" stroke="#b7a684" stroke-width="1"/>
  <path d="M160 202h380M350 62v280" stroke="#c6b593" stroke-width="1.4" opacity=".8"/>
  <path d="M160 62l380 280" stroke="#000" stroke-width="0" />
  <g opacity=".22"><path d="M160 62h380v280H160z" fill="url(#hatch2l)"/></g>
  ${lines}
  <text x="176" y="102" font-family="Georgia,serif" font-size="15" fill="#5b4a35" font-style="italic">To whoever has this ground after me.</text>
  <text x="176" y="352" font-family="Georgia,serif" font-size="17" fill="#7a6a4e" font-style="italic">evin</text>
  </g>
  <g transform="translate(452 300) rotate(24)"><path d="M0 0h16v58c0 14-4 22-8 22s-8-8-8-22z" fill="#5a5f66" stroke="#2b2f34" stroke-width=".8"/><rect x="2" y="-40" width="12" height="42" fill="#3d2a1a" stroke="#241708" stroke-width=".7"/></g>
  ${bulbs}
  <rect width="600" height="380" fill="url(#warml)" opacity=".14"/>
  </svg>`;},

dossier(){const id='d';let ln='';
  for(let i=0;i<18;i++){ln+=`<line x1="228" y1="${140+i*10}" x2="${228+(160+Math.sin(i*2)*44)}" y2="${140+i*10}" stroke="#4a4034" stroke-width=".8" opacity=".6"/>`;}
  return `<svg viewBox="0 0 600 380" role="img" aria-label="A sewn dossier tied with grey ribbon, open on a table by one candle">${defs(id)}
  <rect width="600" height="380" fill="#08090b"/>
  <rect y="250" width="600" height="130" fill="#14110d"/>
  <ellipse cx="180" cy="250" rx="220" ry="80" fill="url(#glowd)" opacity=".45"/>
  <g transform="rotate(-3 380 230)"><rect x="212" y="104" width="230" height="232" fill="#ddd2b8"/><rect x="212" y="104" width="230" height="232" fill="none" stroke="#9d8f70" stroke-width=".9"/>
  <rect x="212" y="104" width="230" height="232" fill="url(#hatch2d)" opacity=".2"/>${ln}
  <path d="M212 132h230M212 340h230" stroke="#8f8266" stroke-width=".6"/>
  <path d="M300 96v250M356 96v250" stroke="#9aa0a6" stroke-width="7" opacity=".55"/>
  <path d="M300 96v250M356 96v250" stroke="#c3c8cc" stroke-width="2" opacity=".5"/></g>
  <g transform="translate(112 196)"><rect x="-11" y="0" width="22" height="86" fill="#e9dfcb"/><path d="M-11 0h22l-2 86h-18z" fill="#c9bda3" opacity=".5"/><ellipse cx="0" cy="0" rx="11" ry="3.4" fill="#f3ead6"/>
  <g><path d="M0 -44c8 13 12 19 12 28a12 12 0 0 1-24 0c0-9 4-15 12-28z" fill="#f6cf94" opacity=".95"/><path d="M0 -26c3.6 6 5.4 9 5.4 13a5.4 5.4 0 0 1-10.8 0c0-4 1.8-7 5.4-13z" fill="#fff8ea"/></g></g>
  <rect y="248" width="600" height="4" fill="${GD}" opacity=".35"/>
  </svg>`;},

plates(){const id='q';let cells='';
  const cols=[V,'#f2e8d6','#e0c9a6','#9c2c36','#d8b877','#efe7d6','#c98f8f','#f5eee0'];
  for(let r=0;r<3;r++)for(let c2=0;c2<5;c2++){
    const x=48+c2*106, y=40+r*112;
    cells+=`<g><rect x="${x}" y="${y}" width="92" height="98" fill="#e9e0cc"/><rect x="${x}" y="${y}" width="92" height="98" fill="none" stroke="#b3a display" stroke-width="0"/><rect x="${x}" y="${y}" width="92" height="98" fill="none" stroke="#a8977a" stroke-width=".7"/>
    ${tulip(x+38,y+74,.94,cols[(r*5+c2)%cols.length])}
    <g transform="translate(${x+72} ${y+66}) scale(.5)"><path d="M0 0c-11 0-18-8-18-19s7-19 18-19 18 8 18 19S11 0 0 0z" fill="#8a6640" stroke="#5b3f22" stroke-width="1"/></g>
    <line x1="${x+10}" y1="${y+86}" x2="${x+58}" y2="${y+86}" stroke="#6d5c40" stroke-width="1.1"/></g>`;
  }
  return `<svg viewBox="0 0 600 380" role="img" aria-label="Forty botanical plates laid out in a grid on a scrubbed table">${defs(id)}
  <rect width="600" height="380" fill="#1a1a19"/>
  <g opacity=".5">${(()=>{let s='';for(let i=0;i<9;i++)s+=`<line x1="0" y1="${i*44}" x2="600" y2="${i*44}" stroke="#33312c" stroke-width="1"/>`;return s;})()}</g>
  <rect width="600" height="380" fill="#cfd6db" opacity=".05"/>
  ${cells}
  <rect x="48" y="376" width="504" height="2" fill="#8a7340" opacity=".3"/>
  </svg>`;},

final(){const id='f';let c='';
  for(let i=0;i<7;i++){const x=60+i*82, out=i<2||i>4;
    c+=`<line x1="${x}" y1="0" x2="${x}" y2="${58+(i%2)*14}" stroke="${GD}" stroke-width=".5" opacity=".5"/><ellipse cx="${x}" cy="${62+(i%2)*14}" rx="26" ry="6" fill="none" stroke="${GD}" stroke-width=".8" opacity=".5"/>`;
    for(let k=0;k<7;k++){const cx=x-24+k*8;const lit=!out&&k%3===0;
      c+=`<line x1="${cx}" y1="${58+(i%2)*14}" x2="${cx}" y2="${62+(i%2)*14}" stroke="${VD}" stroke-width="1.2" opacity=".5"/>${lit?`<circle cx="${cx}" cy="${55+(i%2)*14}" r="2.2" fill="url(#glowf)"/><circle cx="${cx}" cy="${55.5+(i%2)*14}" r=".9" fill="#f6cf94"/>`:''}`;}}
  let f='';for(let i=0;i<13;i++){const x=i*46;f+=`<line x1="${x}" y1="248" x2="${300+(x-300)*2.6}" y2="380" stroke="${GD}" stroke-width=".4" opacity=".3"/>`;}
  for(let i=1;i<7;i++){const y=248+i*i*3.4;f+=`<line x1="0" y1="${y}" x2="600" y2="${y}" stroke="${GD}" stroke-width=".4" opacity=".28"/>`;}
  let w='';for(let i=0;i<4;i++){const x=150+i*100;w+=`<path d="M${x} 232V150a26 26 0 0 1 52 0v82z" fill="#05070a" stroke="${GD}" stroke-width=".6" opacity=".8"/>`;
    for(let r=0;r<7;r++){const rx=x+6+r*7;w+=`<line x1="${rx}" y1="${152+r*5}" x2="${rx-7}" y2="226" stroke="#7f97ab" stroke-width=".45" opacity=".3"/>`;}}
  let ch='';for(let i=0;i<9;i++){const x=30+i*66;ch+=`<rect x="${x}" y="238" width="14" height="16" fill="none" stroke="${GD}" stroke-width=".5" opacity=".35" transform="rotate(${(i%3-1)*9} ${x+7} 246)"/>`;}
  let pr='';for(let i=0;i<16;i++){pr+=`<rect x="${40+Math.random()*520}" y="${288+Math.random()*80}" width="14" height="9" fill="#cfc6b2" opacity=".2" transform="rotate(${Math.random()*70-35} 300 330)"/>`;}
  return `<svg viewBox="0 0 600 380" role="img" aria-label="The same hall, hours later, nearly empty, two figures dancing with no orchestra">${defs(id)}
  <rect width="600" height="380" fill="#08090c"/><rect y="230" width="600" height="150" fill="#0b0d11"/>
  ${w}${f}${ch}${pr}
  <ellipse cx="300" cy="300" rx="150" ry="52" fill="url(#glowf)" opacity=".3"/>
  ${c}
  <g transform="translate(288 292) scale(.72)"><circle cx="0" cy="-40" r="8" fill="${V}"/><path d="M0 -33c-11 0-16 10-17 22-1 10-2 11-2 11h38s-1-1-2-11c-1-12-6-22-17-22z" fill="${V}"/><path d="M14 -22l22 8" stroke="${V}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
  <g transform="translate(336 296) scale(.7)"><circle cx="0" cy="-40" r="8" fill="${VD}"/><path d="M0 -33c-10 0-15 10-16 22-1 10-2 11-2 11h36s-1-1-2-11c-1-12-6-22-16-22z" fill="${VD}"/><path d="M-14 -22l-24 6" stroke="${VD}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
  <line x1="0" y1="232" x2="600" y2="232" stroke="${GD}" stroke-width=".6" opacity=".4"/>
  </svg>`;},

empty(){return ART.garden(true);}
};

/* ─── emblems for the character plates ─────────────────────────── */
const EMBLEM = {
crown:`<svg viewBox="0 0 200 200" role="img" aria-label="An iron crown over a tulip"><g fill="none" stroke="${G}" stroke-width="2"><path d="M46 84l12-30 14 20 14-32 14 32 14-20 12 30z"/><path d="M44 84h112v16H44z"/></g><g fill="${GD}" opacity=".5"><circle cx="58" cy="54" r="3"/><circle cx="100" cy="42" r="3"/><circle cx="142" cy="54" r="3"/></g>${tulip(100,168,1.5,V)}<path d="M44 100h112" stroke="${G}" stroke-width="1" opacity=".5"/></svg>`,
mask:`<svg viewBox="0 0 200 200" role="img" aria-label="A domino mask with one bell"><path d="M42 80c18-12 40-16 58-16s40 4 58 16c3 20-4 38-19 43-13 5-26-2-33-10-6-7-10-9-27-9s-21 2-27 9c-7 8-20 15-33 10-15-5-22-23-19-43z" fill="none" stroke="${G}" stroke-width="2"/><ellipse cx="72" cy="93" rx="17" ry="11" fill="${GD}" opacity=".45"/><ellipse cx="128" cy="93" rx="17" ry="11" fill="${GD}" opacity=".45"/><path d="M100 103v16" stroke="${G}" stroke-width="1.4"/><circle cx="100" cy="140" r="14" fill="none" stroke="${G}" stroke-width="2"/><path d="M88 136h24" stroke="${G}" stroke-width="1.2"/><circle cx="100" cy="150" r="2.6" fill="${G}"/><path d="M100 126v-7" stroke="${G}" stroke-width="1.2"/></svg>`,
bulb:`<svg viewBox="0 0 200 200" role="img" aria-label="A tulip bulb drawn in section"><path d="M100 148c-30 0-48-22-48-52s22-52 48-52 48 22 48 52-18 52-48 52z" fill="none" stroke="${G}" stroke-width="2"/><path d="M100 44c-9 12-14 28-14 44M100 44c9 12 14 28 14 44" fill="none" stroke="${GD}" stroke-width="1.2"/><path d="M100 148v26" stroke="${G}" stroke-width="2"/><path d="M100 174c-14 4-24 10-30 18M100 174c14 4 24 10 30 18" fill="none" stroke="${GD}" stroke-width="1.2"/><path d="M100 96c-6 8-8 18-8 28M100 96c6 8 8 18 8 28" fill="none" stroke="${GD}" stroke-width="1" opacity=".7"/><path d="M100 44V22" stroke="${G}" stroke-width="1.6"/></svg>`,
key:`<svg viewBox="0 0 200 200" role="img" aria-label="A long black garden key"><circle cx="100" cy="52" r="24" fill="none" stroke="${G}" stroke-width="2.4"/><circle cx="100" cy="52" r="11" fill="none" stroke="${GD}" stroke-width="1.4"/><path d="M100 76v96" stroke="${G}" stroke-width="3"/><path d="M100 138h22v10h-22M100 158h16v10h-16" fill="none" stroke="${G}" stroke-width="2.4"/><path d="M84 100h32" stroke="${GD}" stroke-width="1.4"/></svg>`,
quill:`<svg viewBox="0 0 200 200" role="img" aria-label="A quill and a leaf"><path d="M58 168c40-14 78-52 92-104 4 42-10 86-46 108-18 11-34 8-46-4z" fill="none" stroke="${G}" stroke-width="2"/><path d="M150 64c-24 34-52 66-82 92" stroke="${GD}" stroke-width="1.2" fill="none"/><path d="M132 82c-16 6-30 16-40 30M140 106c-16 6-28 16-38 30" stroke="${GD}" stroke-width="1" fill="none" opacity=".8"/><circle cx="52" cy="176" r="6" fill="${G}" opacity=".6"/><path d="M34 40c18 2 30 14 32 32-18-2-30-14-32-32z" fill="none" stroke="${GD}" stroke-width="1.4"/></svg>`,
seal:`<svg viewBox="0 0 200 200" role="img" aria-label="A wax seal and an oak sprig"><circle cx="100" cy="104" r="42" fill="none" stroke="${G}" stroke-width="2.4"/><circle cx="100" cy="104" r="32" fill="none" stroke="${GD}" stroke-width="1"/><path d="M86 92l14 24 14-24" fill="none" stroke="${G}" stroke-width="2"/><path d="M100 40v22" stroke="${GD}" stroke-width="1.4"/><path d="M78 46c8 6 14 12 18 20M122 46c-8 6-14 12-18 20" fill="none" stroke="${GD}" stroke-width="1.2"/><path d="M62 168h76" stroke="${GD}" stroke-width="1.2"/><path d="M100 146v22" stroke="${G}" stroke-width="1.6"/></svg>`,
tulip:`<svg viewBox="0 0 200 200" role="img" aria-label="A single white tulip">${tulip(100,182,3.1,'#f3ead6')}</svg>`
};
</script>
