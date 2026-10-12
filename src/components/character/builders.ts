/**
 * Mascot and people builders, ported from the approved prototype (person(), M, PPL).
 * They return SVG markup strings. The only variable parts are a mascot option such as a colour; Character.tsx
 * allowlists the mascot name and that option before calling in here, so nothing else can reach the markup. Animations are CSS-only
 * (see styles/app.css) and switch off under prefers-reduced-motion.
 */
const INK='#1d2630';
const face=(x:number,y:number,s=1,ink=INK)=>`<g transform="translate(${x} ${y}) scale(${s})"><g class="eyes"><circle cx="-5" cy="0" r="1.9" fill="${ink}"/><circle cx="5" cy="0" r="1.9" fill="${ink}"/></g><circle cx="-8.5" cy="4.6" r="2.3" fill="#F08F7A" opacity=".5"/><circle cx="8.5" cy="4.6" r="2.3" fill="#F08F7A" opacity=".5"/><path d="M-3.5 4q3.5 3.2 7 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/></g>`;
function shade(hex:string,amt:number){ const n=parseInt(hex.slice(1),16); return '#'+[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,v+amt)).toString(16).padStart(2,'0')).join(''); }
export const hash=(s:string)=>{ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))|0; return Math.abs(h); };

export interface PersonOpts {
  skin:string; hair:'short'|'long'|'pony'|'bun'|'bald'; hc:string; shirt:string;
  band?:string; beard?:number; mous?:number; bindi?:number; glasses?:number; steth?:number;
  prop?:'db'|'wave'|'heart'|'stars'|'';
}
export function person(o:PersonOpts){
  const sk=o.skin, hc=o.hc, sh=o.shirt;
  const back = o.hair==='long'?`<path d="M24 37c-1-15 7-23 16-23s17 8 16 23l2 19c-6 4-30 4-36 0z" fill="${hc}"/>`
    : o.hair==='pony'?`<g class="pony"><path d="M51 22c9 1 13 10 10 20-2-5-6-9-11-10z" fill="${hc}"/></g>`
    : o.hair==='bun'?`<circle cx="40" cy="16" r="6.5" fill="${hc}"/>`:'';
  const top: Record<string,string> = {
    short:`<path d="M26.5 34c-1.5-12 5-19 13.5-19s15 6 13.5 19c-2-6-7-9.5-13.5-9.5s-11.5 3.5-13.5 9.5z" fill="${hc}"/>`,
    long:`<path d="M26.5 35c0-12 6-18 13.5-18s13.5 6 13.5 18c-3-6-8-9-14.5-9-5 0-9.5 3-12.5 9z" fill="${hc}"/>`,
    bun:`<path d="M26.5 33c0-10 6-15 13.5-15s13.5 5 13.5 15c-3-5-8-7.5-13.5-7.5s-10.5 2.5-13.5 7.5z" fill="${hc}"/>`,
    bald:`<path d="M26.6 37c-.4-4 .3-7.5 2.4-10-.6 3.6-.4 7 .6 10.4zM53.4 37c.4-4-.3-7.5-2.4-10 .6 3.6.4 7-.6 10.4z" fill="${hc}"/>`
  }; top.pony=top.bun!;
  const arm = o.prop==='db'
    ? `<g class="arm"><path d="M60 84c1-9 3-18 6.5-27" stroke="${sh}" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="66.5" cy="54" r="4.3" fill="${sk}"/><rect x="57" y="52" width="19" height="3.4" rx="1.7" fill="#3a4652"/><rect x="55.5" y="47.5" width="4.6" height="12.4" rx="2" fill="#3368A0"/><rect x="72.8" y="47.5" width="4.6" height="12.4" rx="2" fill="#3368A0"/></g>`
    : o.prop==='wave' ? `<g class="wave"><path d="M61 84c1-8 3-16 6.5-23" stroke="${sh}" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="67.8" cy="57" r="4.4" fill="${sk}"/></g>` : '';
  const extra = (o.prop==='heart'?`<g class="float"><path d="M65 22c-2-3.5-8-2.5-8 2 0 3.5 4.5 6 8 9 3.5-3 8-5.5 8-9 0-4.5-6-5.5-8-2z" fill="#E57C73"/></g>`:'')
    + (o.prop==='stars'?`<g class="twk"><path d="M64 14l1.6 4.4 4.4 1.6-4.4 1.6L64 26l-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#E9B44C"/></g><g class="twk t2"><path d="M15 21l1 2.8 2.8 1-2.8 1L15 28.6l-1-2.8-2.8-1 2.8-1z" fill="#66A3BF"/></g>`:'');
  return back
    + `<path d="M12 84c1-16 12-25 28-25s27 9 28 25z" fill="${sh}"/><path d="M34 59.5l6 6.5 6-6.5" fill="none" stroke="${shade(sh,-34)}" stroke-width="2" stroke-linejoin="round"/>`
    + `<rect x="35" y="45" width="10" height="15" rx="4" fill="${shade(sk,-22)}"/>`
    + (o.steth?`<path d="M33.5 60c-1 8 2 13 6.5 13s7.5-5 6.5-13" stroke="#3368A0" stroke-width="2" fill="none"/><circle cx="40" cy="73" r="2.8" fill="#3368A0"/>`:'')
    + arm
    + `<g class="hd"><circle cx="26.6" cy="37" r="3.2" fill="${sk}"/><circle cx="53.4" cy="37" r="3.2" fill="${sk}"/><ellipse cx="40" cy="35.5" rx="13.5" ry="15" fill="${sk}"/>${top[o.hair] ?? ''}`
    + (o.band?`<path d="M26.7 29.2q13.3-5.4 26.6 0l-.5 3.4q-12.8-4.8-25.6 0z" fill="${o.band}"/>`:'')
    + (o.beard?`<path d="M27.5 39c1 8.5 6 12.5 12.5 12.5s11.5-4 12.5-12.5c-2 3.5-4.5 5.5-7 5.5-1.5-1.5-3.5-2-5.5-2s-4 .5-5.5 2c-2.5 0-5-2-7-5.5z" fill="${hc}"/>`:'')
    + (o.mous?`<path d="M34.5 43.4c2-1.6 4-1.6 5.5-.4 1.5-1.2 3.5-1.2 5.5.4-2 .8-4 .8-5.5 0-1.5.8-3.5.8-5.5 0z" fill="${hc}"/>`:'')
    + (o.bindi?`<circle cx="40" cy="30.4" r="1.1" fill="#C0392B"/>`:'')
    + face(40,37.5,1)
    + (o.glasses?`<g fill="none" stroke="#33404d" stroke-width="1.3"><circle cx="35" cy="37.5" r="4.2"/><circle cx="45" cy="37.5" r="4.2"/><path d="M39.2 37.2h1.6"/></g>`:'')
    + `</g>` + extra;
}

export const PPL: Record<string,PersonOpts> = {
  fam:{skin:'#B97A4E',hair:'short',hc:'#21160F',shirt:'#3368A0',band:'#66A3BF',prop:'db'},
  mapl:{skin:'#C68B59',hair:'short',hc:'#2B1D16',shirt:'#66A3BF',prop:'stars'},
  madv:{skin:'#A8703F',hair:'short',hc:'#1E1510',shirt:'#7FB5A8',beard:1,prop:'wave'},
  smen:{skin:'#C68B59',hair:'bald',hc:'#C9CDD2',shirt:'#E9B44C',glasses:1,mous:1,prop:'wave'},
  pmm:{skin:'#B97A4E',hair:'short',hc:'#2B1D16',shirt:'#3368A0',prop:'heart'},
  faw:{skin:'#D9A273',hair:'pony',hc:'#2A1A12',shirt:'#E57C73',band:'#3368A0',prop:'db'},
  wapl:{skin:'#C68B59',hair:'long',hc:'#24170F',shirt:'#3368A0',bindi:1,prop:'stars'},
  wadv:{skin:'#E0AC7E',hair:'long',hc:'#3A2418',shirt:'#E9B44C',prop:'wave'},
  nurse:{skin:'#C68B59',hair:'bun',hc:'#2B1D16',shirt:'#F4F7F9',steth:1,prop:'wave'},
  swom:{skin:'#B97A4E',hair:'bun',hc:'#C9CDD2',shirt:'#7FB5A8',glasses:1,bindi:1,prop:'wave'},
};

const petals=(n:number,r:number,pr:number,fill:string)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return `<circle cx="${(40+r*Math.cos(a)).toFixed(1)}" cy="${(40+r*Math.sin(a)).toFixed(1)}" r="${pr}" fill="${fill}"/>`;}).join('');
const RAYS=Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2,c=Math.cos(a),s=Math.sin(a);return `<path d="M${(40+21*c).toFixed(1)} ${(40+21*s).toFixed(1)}L${(40+28*c).toFixed(1)} ${(40+28*s).toFixed(1)}"/>`;}).join('');
const LIVER=`<path d="M12 40c0-15 15-22 32-20 13 1 24 6 24 15 0 11-15 23-30 25-15 2-26-6-26-20z" fill="#C9786A"/><path d="M45 21c-2 8-1 18 4 26" stroke="#A9604F" stroke-width="2" fill="none" stroke-linecap="round"/>${face(30,40)}`;
const KIDNEY=`<path d="M46 15c-15-3-28 8-28 25s13 28 28 25c8-2 10-10 5-15-4-4-4-10 0-14 6-6 4-19-5-21z" fill="#D98373"/><path d="M52 34c4 0 7 2 9 5" stroke="#66A3BF" stroke-width="3" fill="none" stroke-linecap="round"/>${face(34,40)}`;
const DROP=`<path d="M40 13s18 20 18 34a18 18 0 0 1-36 0c0-14 18-34 18-34z" fill="#E57C73"/><path d="M30 45c0-5 3-10 6-14" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" fill="none"/>${face(40,50)}`;
const PILL=`<g transform="rotate(-35 40 42)"><rect x="18" y="31" width="44" height="22" rx="11" fill="#fff" stroke="#3368A0" stroke-width="2"/><path d="M40 31h11a11 11 0 0 1 0 22H40z" fill="#66A3BF"/></g>${face(31,47,.68)}`;
const FILM=`<rect x="14" y="10" width="52" height="60" rx="6" fill="#24384C"/>`;
const SCAN=`<g class="scan"><rect x="14" y="12" width="52" height="3" fill="#66A3BF"/></g>`;
const STAR=(x:number,y:number,c:string,cls='twk')=>`<g class="${cls}"><path d="M${x} ${y}l1.8 4.6 4.6 1.8-4.6 1.8L${x} ${y+12.8}l-1.8-4.6-4.6-1.8 4.6-1.8z" fill="${c}"/></g>`;

export const M: Record<string,(arg?:string)=>string> = {
  drop:()=>`<g class="bob">${DROP}</g>`,
  cbc:()=>`<g class="bob">${DROP}</g><g class="lens"><circle cx="59" cy="25" r="9" fill="#fff" fill-opacity=".55" stroke="#3368A0" stroke-width="3"/><path d="M65.5 31.5l6.5 6.5" stroke="#3368A0" stroke-width="4.5" stroke-linecap="round"/></g>`,
  hba:()=>`<g class="bob">${DROP}</g>${STAR(61,12,'#E9B44C')}`,
  liver:()=>`<g class="bob">${LIVER}</g>`,
  kidney:()=>`<g class="bob">${KIDNEY}</g>`,
  lk:()=>`<g class="bob"><g transform="translate(-4 14) scale(.62)">${LIVER}</g></g><g class="bob b2"><g transform="translate(32 6) scale(.62)">${KIDNEY}</g></g>`,
  fly:()=>`<g class="wing"><path d="M40 40C34 24 14 18 12 31c-2 11 12 19 28 16z" fill="#66A3BF"/><path d="M40 45c-8 2-20 6-18 14 2 6 12 4 18-6z" fill="#9CC4D6"/><path d="M40 40C46 24 66 18 68 31c2 11-12 19-28 16z" fill="#66A3BF"/><path d="M40 45c8 2 20 6 18 14-2 6-12 4-18-6z" fill="#9CC4D6"/></g><path d="M37 27c-2-5-5-7-8-7M43 27c2-5 5-7 8-7" stroke="#3368A0" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="33.5" y="25" width="13" height="34" rx="6.5" fill="#3368A0"/>${face(40,38,.6,'#fff')}`,
  flask:(liq:string='#66A3BF')=>`<g class="bob"><path d="M23 57L35 33V17h10v16l12 24a6 6 0 0 1-5.4 8.6H28.4A6 6 0 0 1 23 57z" fill="#fff" stroke="#3368A0" stroke-width="2.5" stroke-linejoin="round"/><path d="M27.3 48.5h25.4L57 57a6 6 0 0 1-5.4 8.6H28.4A6 6 0 0 1 23 57z" fill="${liq}"/><rect x="31.5" y="12.5" width="17" height="5.5" rx="2.75" fill="#3368A0"/><g class="bub"><circle cx="36" cy="54" r="2" fill="#fff"/></g><g class="bub b2"><circle cx="44" cy="56" r="1.6" fill="#fff"/></g>${face(40,40,.68)}</g>`,
  flower:()=>`<g class="spin">${petals(6,13,8.5,'#F3B5A8')}</g><circle cx="40" cy="40" r="11" fill="#E9B44C"/>${face(40,40,.62)}<g class="drift"><circle cx="64" cy="18" r="1.8" fill="#E9B44C"/><circle cx="15" cy="62" r="1.5" fill="#E9B44C"/><circle cx="67" cy="62" r="1.3" fill="#E9B44C"/></g>`,
  mould:()=>`<g class="bob"><circle cx="29" cy="45" r="12" fill="#A9C3AC"/><circle cx="51" cy="45" r="12" fill="#A9C3AC"/><circle cx="40" cy="34" r="14" fill="#B8D0BA"/><circle cx="40" cy="49" r="13" fill="#B8D0BA"/>${face(40,43,.85)}</g><g class="drift"><circle cx="63" cy="20" r="2.4" fill="#A9C3AC"/><circle cx="17" cy="23" r="1.8" fill="#A9C3AC"/><circle cx="65" cy="66" r="1.6" fill="#A9C3AC"/></g>`,
  egg:()=>`<g class="wob"><ellipse cx="40" cy="44" rx="17" ry="21" fill="#FFFDF7" stroke="#E2D7C1" stroke-width="2"/>${face(40,48)}</g>`,
  fried:()=>`<g class="bob"><path d="M18 46c-4-10 6-20 16-18 6-8 20-6 24 2 10 0 14 12 8 20 2 10-10 14-18 10-8 6-22 4-24-4-8 0-10-6-6-10z" fill="#FFFDF7" stroke="#E2D7C1" stroke-width="2"/><circle cx="41" cy="44" r="12.5" fill="#F2B640"/>${face(41,45,.72)}</g>`,
  wheat:()=>{ let g=''; for(let i=0;i<4;i++){ const y=33+i*9; g+=`<ellipse cx="34.5" cy="${y}" rx="4.2" ry="7" fill="#E9B44C" transform="rotate(-32 34.5 ${y})"/><ellipse cx="45.5" cy="${y}" rx="4.2" ry="7" fill="#E9B44C" transform="rotate(32 45.5 ${y})"/>`; }
    return `<g class="sway"><path d="M40 74V24" stroke="#C99A3E" stroke-width="2.6" stroke-linecap="round"/>${g}<ellipse cx="40" cy="19" rx="8.5" ry="10.5" fill="#F2C14E"/>${face(40,20,.52)}</g>`; },
  onion:()=>`<g class="wob"><path d="M40 18c-4 6-21 15-21 31 0 11 9 17 21 17s21-6 21-17c0-16-17-25-21-31z" fill="#C98BB0"/><path d="M40 20c-6 10-10 22-8 46M40 20c6 10 10 22 8 46" stroke="#B0729A" stroke-width="1.5" fill="none"/><path d="M40 18c0-5 2-8 5-10M40 18c-1-4-3-6-6-7" stroke="#7FB5A8" stroke-width="2.6" fill="none" stroke-linecap="round"/>${face(40,48)}</g>`,
  mite:()=>`<g class="hov"><g stroke="#8C7A62" stroke-width="2.2" stroke-linecap="round"><path d="M27 39l-9-5M26 47H16M27 54l-9 6M53 39l9-5M54 47h10M53 54l9 6"/></g><circle cx="40" cy="31" r="7.5" fill="#B49C78"/><ellipse cx="40" cy="47" rx="15" ry="13" fill="#C4AE8C"/>${face(40,47,.8)}</g>`,
  plate:(it:string='')=>`<g class="bob"><circle cx="40" cy="45" r="22" fill="#fff" stroke="#DDD8CC" stroke-width="2"/><circle cx="40" cy="45" r="15" fill="none" stroke="#EEE9DE" stroke-width="2"/>${face(40,47,.85)}</g>`
    + (it.includes('c')?`<g class="sway"><path d="M67 13L55 35l5 2.5z" fill="#F08A4B"/><path d="M67 13l3-6M67 13l6-2" stroke="#7FB5A8" stroke-width="2.4" stroke-linecap="round"/></g>`:'')
    + (it.includes('d')?`<g class="sway b2"><path d="M20 33l-6 6" stroke="#F3E6D3" stroke-width="4" stroke-linecap="round"/><circle cx="13" cy="40" r="2.6" fill="#F3E6D3"/><ellipse cx="25" cy="26" rx="8" ry="10" fill="#C8834A" transform="rotate(40 25 26)"/></g>`:''),
  bandaid:()=>`<g class="wob"><g transform="rotate(-28 40 44)"><rect x="10" y="32" width="60" height="24" rx="12" fill="#F2C9A8"/><rect x="29" y="32" width="22" height="24" fill="#E8B48E"/></g>${face(40,44,.72)}</g>`,
  clip:()=>`<g class="bob"><rect x="20" y="16" width="40" height="52" rx="6" fill="#fff" stroke="#3368A0" stroke-width="2.5"/><rect x="31" y="11" width="18" height="9" rx="3" fill="#3368A0"/><path d="M27 33l3 3 5-6M27 45l3 3 5-6M27 57l3 3 5-6" stroke="#66A3BF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 33h13M40 45h13M40 57h10" stroke="#DDD8CC" stroke-width="2.4" stroke-linecap="round"/></g>${STAR(64,8,'#E9B44C')}`,
  thermo:()=>`<g class="bob"><rect x="31" y="9" width="18" height="46" rx="9" fill="#fff" stroke="#3368A0" stroke-width="2.5"/><g class="merc"><rect x="37" y="20" width="6" height="36" rx="3" fill="#E57C73"/></g><circle cx="40" cy="59" r="11" fill="#E57C73" stroke="#3368A0" stroke-width="2.5"/>${face(40,59,.58,'#fff')}</g><g class="drip"><path d="M60 22s4 5 4 7.5a4 4 0 0 1-8 0c0-2.5 4-7.5 4-7.5z" fill="#66A3BF"/></g>`,
  mosq:()=>`<g class="hov"><g class="flut"><ellipse cx="29" cy="31" rx="12" ry="6.5" fill="#E3EFF5" stroke="#66A3BF" stroke-width="1.5"/><ellipse cx="51" cy="31" rx="12" ry="6.5" fill="#E3EFF5" stroke="#66A3BF" stroke-width="1.5"/></g><g stroke="#46525E" stroke-width="1.8" stroke-linecap="round"><path d="M34 51l-8 9M40 55v9M46 51l8 9M33 34l-10-2"/></g><ellipse cx="40" cy="45" rx="9" ry="12" fill="#5C6B78"/><circle cx="40" cy="31" r="8" fill="#46525E"/>${face(40,31,.55,'#fff')}</g>`,
  sugar:(d?:string)=>`<g class="bob"><path d="M20 32l20-10 20 10v24l-20 10-20-10z" fill="#fff" stroke="#BFD6D2" stroke-width="2" stroke-linejoin="round"/><path d="M20 32l20 10 20-10M40 42v24" stroke="#BFD6D2" stroke-width="2" fill="none"/>${face(30,49,.62)}</g>`
    + (d?`<g class="bob b2"><g transform="translate(44 2) scale(.42)">${DROP}</g></g>`:STAR(64,12,'#E9B44C')),
  sun:(p?:string)=>`<g class="spin"><g stroke="#E9B44C" stroke-width="3.5" stroke-linecap="round">${RAYS}</g></g><circle cx="40" cy="40" r="15.5" fill="#F2C14E"/>${face(40,41)}`
    + (p?`<g class="bob b2"><g transform="translate(42 42) scale(.48)">${PILL}</g></g>`:''),
  pill:()=>`<g class="bob">${PILL}</g>${STAR(62,12,'#66A3BF')}`,
  leaf:()=>`<g class="sway"><path d="M20 64C18 37 34 18 63 16c2 29-14 48-43 48z" fill="#7FB5A8"/><path d="M20 64C30 48 42 35 57 22" stroke="#5E9A8B" stroke-width="2" fill="none"/>${face(37,46,.8)}</g>`,
  xray:()=>`${FILM}<g stroke="#DCE9F0" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".9"><path d="M40 18v46"/><path d="M38 26c-8 0-14 3-16 8M38 34c-8 0-14 3-16 8M38 42c-8 0-13 3-15 8M38 50c-7 0-11 2-13 6M42 26c8 0 14 3 16 8M42 34c8 0 14 3 16 8M42 42c8 0 13 3 15 8M42 50c7 0 11 2 13 6"/></g>${SCAN}`,
  knee:()=>`${FILM}<g fill="#DCE9F0" opacity=".9"><path d="M34 12h12v22c3 1 5 3 5 6H29c0-3 2-5 5-6z"/><path d="M30 46h20c0 3-2 5-5 6v18H35V52c-3-1-5-3-5-6z"/><circle cx="52" cy="43" r="3.5"/></g>${SCAN}`,
  usg:()=>`<rect x="12" y="12" width="56" height="44" rx="6" fill="#24384C"/><path d="M40 18L22 50a40 40 0 0 0 36 0z" fill="#3A5269"/><ellipse cx="41" cy="40" rx="7" ry="5" fill="#7C98AE"/><g class="ping"><path d="M28 30a16 16 0 0 1 24 0" stroke="#66A3BF" stroke-width="2" fill="none"/></g><rect x="30" y="58" width="20" height="5" rx="2.5" fill="#B9C5CF"/><rect x="26" y="63" width="28" height="5" rx="2.5" fill="#B9C5CF"/>`,
  heart:()=>`<g class="beat"><path d="M40 64C18 50 12 38 16 28c4-9 16-11 24-2 8-9 20-7 24 2 4 10-2 22-24 36z" fill="#E57C73"/>${face(40,40)}</g><path class="pulse" d="M6 57h16l4-8 5 14 4-10h39" stroke="#3368A0" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`,
  phone:()=>`<g class="bob"><rect x="24" y="9" width="32" height="62" rx="8" fill="#0F2236"/><rect x="27" y="14" width="26" height="52" rx="5" fill="#fff"/>${face(40,32,.75)}<rect x="31" y="46" width="18" height="7" rx="3.5" fill="#3368A0"/></g><g class="tap"><circle cx="58" cy="52" r="7" fill="none" stroke="#66A3BF" stroke-width="2"/></g>${STAR(62,12,'#E9B44C')}`,
  family:()=>`<g transform="translate(-14 12) scale(.84)">${person({...(PPL.madv as PersonOpts),prop:''})}</g><g transform="translate(26 14) scale(.8)">${person({...(PPL.wadv as PersonOpts),prop:''})}</g>`,
};
