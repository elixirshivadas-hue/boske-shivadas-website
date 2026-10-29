/* NIJØK Study — pure scoring module (no DOM, no Firebase).
   PROTOTYPE SCORING: runs in the browser, so answer keys are present in client code.
   Do not use for rankings/certificates/anything high-stakes; move to a server (Cloud Function)
   before any real exam use. */
(function(root){
'use strict';
// Marking presets. wrong = marks deducted per wrong answer (positive number).
// "verified" = checked against an official notification during build; others must be re-checked by the owner.
const PRESETS={
  practice:{label:'Practice (no negative)',correct:1,wrong:0,verified:true},
  ssc:{label:'SSC CGL Tier-I style (+2 / −0.5)',correct:2,wrong:0.5,verified:true},
  rrb:{label:'RRB NTPC CBT-1 style (+1 / −1/3)',correct:1,wrong:1/3,verified:true},
  bank:{label:'Banking prelims style (+1 / −0.25)',correct:1,wrong:0.25,verified:false},
  upsc:{label:'UPSC GS Paper-I style (+2 / −2/3)',correct:2,wrong:2/3,verified:false},
  nda:{label:'NDA style (+q / −q/3)',correct:1,wrong:1/3,verified:true}
};
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
const isIdx=(v,n)=>Number.isInteger(v)&&v>=0&&v<n;
/* items: [{id,a,n?}]  a = index of correct option, n = option count (default 4)
   answers: {id: selectedIndex}  (missing / null / invalid => unanswered)
   cfg: {correct, wrong}  */
function score(items,answers,cfg){
  if(!Array.isArray(items))throw new TypeError('items must be an array');
  cfg=Object.assign({correct:1,wrong:0},cfg||{});
  if(!(cfg.correct>=0)||!(cfg.wrong>=0))throw new RangeError('marks must be >= 0');
  answers=answers||{};
  let correct=0,wrong=0,unanswered=0,invalid=0;
  for(const it of items){
    const n=it.n||4,v=answers[it.id];
    if(v===undefined||v===null){unanswered++;continue}
    if(!isIdx(v,n)){invalid++;unanswered++;continue}
    if(v===it.a)correct++;else wrong++;
  }
  const total=items.length,attempted=correct+wrong;
  const marks=r2(correct*cfg.correct-wrong*cfg.wrong);
  const max=r2(total*cfg.correct);
  return{total,attempted,correct,wrong,unanswered,invalid,marks,max,
    accuracy:attempted?r2(correct/attempted*100):0,        // % of attempted that were right
    percent:max?r2(marks/max*100):0};                       // marks as % of max (can be negative)
}
// Breakdown by a key function, e.g. it=>it.s (subject) or it=>it.t (topic)
function breakdown(items,answers,keyFn,cfg){
  const g={};
  for(const it of items){const k=keyFn(it);(g[k]=g[k]||[]).push(it)}
  const out={};
  for(const k of Object.keys(g))out[k]=score(g[k],answers,cfg);
  return out;
}
// Rank subjects: strong = accuracy>=70 with >=5 attempts; weak = accuracy<50 with >=5 attempts
function strongWeak(stats,minAttempts){
  minAttempts=minAttempts||5;const strong=[],weak=[];
  for(const k of Object.keys(stats)){
    const s=stats[k];if((s.a||0)<minAttempts)continue;
    const acc=s.c/s.a*100;
    if(acc>=70)strong.push({k,acc:r2(acc),a:s.a});else if(acc<50)weak.push({k,acc:r2(acc),a:s.a});
  }
  strong.sort((x,y)=>y.acc-x.acc);weak.sort((x,y)=>x.acc-y.acc);
  return{strong,weak};
}
/* Readiness indicator (NOT a prediction): 60% recent accuracy, 25% coverage, 15% mock average.
   in: {recentAttempted, recentCorrect, uniqueSeen, poolSize, mockPercents:[...]} */
function readiness(i){
  const acc=i.recentAttempted?i.recentCorrect/i.recentAttempted:0;
  const cov=i.poolSize?Math.min(1,i.uniqueSeen/i.poolSize):0;
  const m=(i.mockPercents||[]).filter(x=>isFinite(x));
  const mk=m.length?Math.max(0,Math.min(100,m.reduce((a,b)=>a+b,0)/m.length))/100:0;
  return r2((0.6*acc+0.25*cov+0.15*mk)*100);
}
function daysLeft(dateStr,now){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr||''))return null;
  const a=Date.UTC(...dateStr.split('-').map((x,i)=>i===1?x-1:+x));
  const n=now||new Date();const b=Date.UTC(n.getFullYear(),n.getMonth(),n.getDate());
  return Math.round((a-b)/864e5);
}
// Spaced revision: wrong answers come back after 1, 3, 7 days (stage = times answered correctly since the miss)
const GAPS=[1,3,7];
function revisionDue(wrongMap,today){
  // wrongMap: {qid:{d:'YYYY-MM-DD' last wrong or last revised, st:stage 0..3}}
  const t=Date.UTC(...today.split('-').map((x,i)=>i===1?x-1:+x)),due=[];
  for(const id of Object.keys(wrongMap||{})){
    const w=wrongMap[id];if(!w||w.st>=GAPS.length)continue;
    const d=Date.UTC(...w.d.split('-').map((x,i)=>i===1?x-1:+x));
    if((t-d)/864e5>=GAPS[w.st])due.push(id);
  }
  return due;
}
const api={PRESETS,score,breakdown,strongWeak,readiness,daysLeft,revisionDue,GAPS,r2};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NKScore=api;
})(typeof window!=='undefined'?window:globalThis);
