import { useState, useMemo } from "react";
import type { Settings, ImageDensityMap } from "../App";

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const CHAR_SETS: Record<string, string> = {
  standard:   ".,~-:;=!*#@",
  dots_set:   "·:.,;·",
  steps:      " .:;=+*#@",
  lines_only: "|/-\\+",
  binary:     "01",
  boxes:      "█▓▒░ ",
  light:      " .-=:",
  numbers:    "0123456789",
  letters:    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
};

function resolvedPool(s: Settings): string {
  if (s.charSet === "custom") return s.customChars.trim() || "0123456789";
  return CHAR_SETS[s.charSet] ?? "0123456789";
}

// ── React/Next.js component generator ────────────────────────────────────────

function genReact(s: Settings, map: ImageDensityMap | null): string {
  const pool    = resolvedPool(s);
  const hasMap  = s.pattern === "image" && map;
  const cfg     = JSON.stringify({ ...s, charSet: undefined, customChars: undefined }, null, 2);

  return `\
"use client";
/**
 * ASCII Art Background — exported ${new Date().toLocaleDateString()}
 *
 * React / Next.js (App Router or Pages Router) — no external dependencies.
 *
 * Usage:
 *   import { AsciiBackground } from "./AsciiBackground";
 *
 *   // Fill parent container
 *   <AsciiBackground />
 *
 *   // Full-page fixed background
 *   <AsciiBackground style={{ position: "fixed", inset: 0, zIndex: -1 }} />
 */

import { useEffect, useRef } from "react";

/* ── Configuration (edit to taste) ──────────────────────────────────────── */
const C = ${cfg.replace(/"([^"]+)":/g, "$1:")};
const POOL = ${JSON.stringify(pool)};
${hasMap ? `const DRAW_MAP = ${JSON.stringify(map)};` : ""}

/* ── Colour utilities ────────────────────────────────────────────────────── */
const hexRgb = h => { const m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h.trim()); return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : [255,255,255]; };
const clamp  = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const lerp   = (a,b,t)   => a + (b-a)*t;

function buildLUT(mode,c1,c2,c3,sat) {
  const [r1,g1,b1]=hexRgb(c1),[r2,g2,b2]=mode!=="mono"?hexRgb(c2):[r1,g1,b1],[r3,g3,b3]=mode==="trio"?hexRgb(c3):[r2,g2,b2];
  return Array.from({length:256},(_,i)=>{
    const t=i/255; let r,g,b;
    if(mode==="mono"){r=r1;g=g1;b=b1;}
    else if(mode==="duo"){r=Math.round(r1+(r2-r1)*t);g=Math.round(g1+(g2-g1)*t);b=Math.round(b1+(b2-b1)*t);}
    else if(t<.5){const u=t*2;r=Math.round(r1+(r2-r1)*u);g=Math.round(g1+(g2-g1)*u);b=Math.round(b1+(b2-b1)*u);}
    else{const u=(t-.5)*2;r=Math.round(r2+(r3-r2)*u);g=Math.round(g2+(g3-g2)*u);b=Math.round(b2+(b3-b2)*u);}
    if(sat!==1){const lm=.299*r+.587*g+.114*b;r=clamp(Math.round(lm+(r-lm)*sat),0,255);g=clamp(Math.round(lm+(g-lm)*sat),0,255);b=clamp(Math.round(lm+(b-lm)*sat),0,255);}
    return \`#\${r.toString(16).padStart(2,"0")}\${g.toString(16).padStart(2,"0")}\${b.toString(16).padStart(2,"0")}\`;
  });
}

/* ── 2-D noise (flat mode) ───────────────────────────────────────────────── */
const h21  = (x,y) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
const vNoise = (x,y) => { const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),a=h21(ix,iy),b=h21(ix+1,iy),c=h21(ix,iy+1),d=h21(ix+1,iy+1); return a+(b-a)*ux+(c-a)*uy+(d-b-c+a)*ux*uy; };
const fbm  = (x,y,o=5) => { let v=0,amp=.5,f=1,s=0; for(let i=0;i<o;i++){v+=vNoise(x*f,y*f)*amp;s+=amp;amp*=.5;f*=2;} return v/s; };

/* ── Character helpers ───────────────────────────────────────────────────── */
const cellChar = (c,r) => { const h=Math.abs(Math.sin(c*127.1+r*311.7)*43758.5453); return POOL[Math.floor((h-Math.floor(h))*POOL.length)]; };
const pickChar = ()    => POOL[Math.floor(Math.random()*POOL.length)];

/* ── Flat-mode renderer ──────────────────────────────────────────────────── */
function drawFlat(ctx,w,h,lut,dm) {
  if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}
  else ctx.fillStyle=C.bgColor1;
  ctx.fillRect(0,0,w,h);
  const sf=C.zoom/100,sp=clamp(C.speed,.2,3),px=Math.round(C.baseSize*sf);
  const cW=C.baseSize*1.1*sf*sp,cH=C.baseSize*1.6*sf*sp;
  const vC=Math.ceil(w/cW)+1,vR=Math.ceil(h/cH)+1;
  const nsx=2/Math.max(1,vC),nsy=2/Math.max(1,vR);
  const thr=lerp(.65,.22,(C.density-.4)/1.6);
  const aRad=C.angle*Math.PI/180,caR=C.charAngle*Math.PI/180,useCA=Math.abs(caR)>.001;
  const diag=Math.sqrt(w*w+h*h),pC=Math.ceil((diag-w)/2/cW)+2,pR=Math.ceil((diag-h)/2/cH)+2;
  const ccx=vC/2,ccy=vR/2; let lf="";
  ctx.font=\`\${px}px 'Courier New',monospace\`;
  ctx.save();
  if(Math.abs(aRad)>.001){ctx.translate(w/2,h/2);ctx.rotate(aRad);ctx.translate(-w/2,-h/2);}
  for(let row=-pR;row<vR+pR;row++){
    for(let col=-pC;col<vC+pC;col++){
      let str;
      if(dm){const mx=clamp(Math.floor((col/vC)*dm.w),0,dm.w-1),my=clamp(Math.floor((row/vR)*dm.h),0,dm.h-1),val=dm.data[my*dm.w+mx]??0;if(val<.04)continue;str=val;}
      else{const n=fbm(col*nsx,row*nsy);if(n<thr)continue;str=(n-thr)/(1-thr);}
      let tG;
      switch(C.gradientDir){
        case"horizontal":tG=clamp(col/vC,0,1);break;
        case"vertical":  tG=clamp(row/vR,0,1);break;
        case"radial":{const dx=(col-ccx)/(vC*.5),dy=(row-ccy)/(vR*.5);tG=clamp(Math.sqrt(dx*dx+dy*dy)/Math.SQRT2,0,1);break;}
        default:         tG=clamp((col/vC)*.5+(row/vR)*.5,0,1);
      }
      const fill=lut[Math.round(tG*255)]??lut[0],op=clamp((str*.35+.75)*C.colorOpacity,.02,1);
      if(useCA){const tx=col*cW+px*.3,ty=row*cH+px*.45;ctx.save();ctx.globalAlpha=op;ctx.fillStyle=fill;ctx.translate(tx,ty);ctx.rotate(caR);ctx.fillText(cellChar(col,row),-px*.3,px*.45);ctx.restore();}
      else{if(fill!==lf){ctx.fillStyle=fill;lf=fill;}ctx.globalAlpha=op;ctx.fillText(cellChar(col,row),col*cW,row*cH+px);}
    }
  }
  ctx.restore();ctx.globalAlpha=1;
}

/* ── 3-D cluster + particle builders ────────────────────────────────────── */
function buildClusters(w,h) {
  const d=C.density,mg=60,cls=[];
  const cnt=Math.round(10+d*3),minD=Math.min(w,h)*.13;
  for(let i=0;i<cnt;i++){
    let ok=false;
    for(let a=0;a<60;a++){
      const cx=mg+Math.random()*(w-2*mg),cy=mg+Math.random()*(h-2*mg);
      if(cls.every(e=>Math.hypot(cx-e.bx,cy-e.by)>=minD)){
        const r=70+Math.random()*160;
        cls.push({x:cx,y:cy,bx:cx,by:cy,r,ph:Math.random()*Math.PI*2,sp:.00012+Math.random()*.0003,ax:25+Math.random()*55,ay:18+Math.random()*42,pc:clamp(Math.floor(r*r*.03*d),80,500)});
        ok=true;break;
      }
    }
    if(!ok){const r=60+Math.random()*100;cls.push({x:mg+Math.random()*(w-2*mg),y:mg+Math.random()*(h-2*mg),bx:0,by:0,r,ph:Math.random()*Math.PI*2,sp:.00012+Math.random()*.0003,ax:20+Math.random()*40,ay:15+Math.random()*30,pc:clamp(Math.floor(r*r*.03*d),50,300)});const c=cls[cls.length-1];c.bx=c.x;c.by=c.y;}
  }
  const max=Math.floor(4000*Math.min(d,2)),tot=cls.reduce((s,c)=>s+c.pc,0);
  if(tot>max){const sc=max/tot;for(const c of cls)c.pc=Math.max(8,Math.floor(c.pc*sc));}
  return cls;
}
function buildParticles(cls,now) {
  const ps=[];
  for(const c of cls){
    for(let i=0;i<c.pc;i++){
      const ang=Math.random()*Math.PI*2,u1=Math.max(Math.random(),1e-9),u2=Math.random(),g=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2),r=Math.min(Math.abs(g)*.42,1)*c.r,dn=r/c.r,nt=clamp(1-dn,0,1),bx=c.bx+Math.cos(ang)*r,by=c.by+Math.sin(ang)*r;
      ps.push({x:bx,y:by,bx,by,z:(Math.random()-.5)*600,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.09,ch:pickChar(),fs:Math.round(clamp(lerp(22,7,dn*dn)+(Math.random()-.5)*2,7,22)),nt,op:clamp(lerp(.88,.08,dn)*(.55+Math.random()*.45),.06,.92),px:Math.random()*Math.PI*2,py:Math.random()*Math.PI*2,fx:.0003+Math.random()*.0005,fy:.0002+Math.random()*.0004,ax:4+Math.random()*15,ay:3+Math.random()*12,rt:now+8000+Math.random()*7000});
    }
  }
  ps.sort((a,b)=>a.fs-b.fs);return ps;
}

/* ── Component ───────────────────────────────────────────────────────────── */
export function AsciiBackground({ style, className }) {
  const canvasRef  = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current, wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, lut = [], clusters = [], particles = [], flatKey = "", lastFS = -1, lastLI = -1;

    function init() {
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      if (!w || !h) return;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lut = buildLUT(C.colorMode, C.color1, C.color2, C.color3, C.colorSaturation);
      flatKey = "";
      if (C.dimension === "3d") { clusters = buildClusters(w, h); particles = buildParticles(clusters, performance.now()); }
    }
    init();

    function tick(ts) {
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      if (!w || !h) { raf = requestAnimationFrame(tick); return; }

      /* ── Flat ── */
      if (C.dimension === "flat") {
        const k = [w,h,C.baseSize,C.density,C.zoom,C.speed,C.angle,C.charAngle,C.gradientDir,C.colorMode,C.color1,C.color2,C.color3,C.colorOpacity,C.colorSaturation,C.bgMode,C.bgColor1,C.bgColor2].join("|");
        if (k !== flatKey) { flatKey = k; drawFlat(ctx, w, h, lut, ${hasMap ? "DRAW_MAP" : "null"}); }
        raf = requestAnimationFrame(tick); return;
      }

      /* ── 3-D ── */
      const {speed,baseSize,minSize,sizeRange,zoom,colorOpacity} = C;
      const focal=500,cx=w/2,cy=h/2,aOff=C.angle*Math.PI/180,caR=C.charAngle*Math.PI/180,useCA=Math.abs(caR)>.001;
      const rotA=ts*.00004*speed+aOff,cosA=Math.cos(rotA),sinA=Math.sin(rotA),zf=zoom/100;

      if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}
      else ctx.fillStyle=C.bgColor1;
      ctx.fillRect(0,0,w,h); ctx.globalAlpha=1; lastFS=-1; lastLI=-1;

      for(const c of clusters){c.x=c.bx+Math.sin(ts*c.sp*speed+c.ph)*c.ax;c.y=c.by+Math.cos(ts*c.sp*speed*.7+c.ph)*c.ay;}

      for(const p of particles){
        p.bx+=p.vx*speed;p.by+=p.vy*speed;
        const mg=50;if(p.bx<-mg)p.bx+=w+mg*2;else if(p.bx>w+mg)p.bx-=w+mg*2;if(p.by<-mg)p.by+=h+mg*2;else if(p.by>h+mg)p.by-=h+mg*2;
        p.x=p.bx+Math.sin(ts*p.fx*speed+p.px)*p.ax;p.y=p.by+Math.cos(ts*p.fy*speed+p.py)*p.ay;
        if(ts>=p.rt){p.ch=pickChar();p.rt=ts+8000+Math.random()*7000;}
        const relX=p.x-cx,rotX=relX*cosA-p.z*sinA,rotZ=relX*sinA+p.z*cosA,depth=focal+rotZ,sc=focal/Math.max(depth,50);
        let dx=cx+rotX*sc,dy=cy+(p.y-cy)*sc;
        const bFS=sizeRange?lerp(minSize,baseSize,p.nt):baseSize,dFS=Math.max(4,bFS*sc),dA=clamp(p.op*Math.min(1.5,sc*1.1)*colorOpacity,.02,1);
        dx=cx+(dx-cx)*zf; dy=cy+(dy-cy)*zf;
        let tG;
        switch(C.gradientDir){case"horizontal":tG=clamp(dx/w,0,1);break;case"vertical":tG=clamp(dy/h,0,1);break;case"radial":{const rx=(dx-cx)/(w*.5),ry=(dy-cy)/(h*.5);tG=clamp(Math.sqrt(rx*rx+ry*ry)/Math.SQRT2,0,1);break;}default:tG=clamp((dx/w)*.5+(dy/h)*.5,0,1);}
        const li=Math.round(tG*255),rs=Math.round(dFS);
        if(rs!==lastFS){ctx.font=\`\${rs}px 'Courier New',monospace\`;lastFS=rs;}
        ctx.globalAlpha=dA;
        if(li!==lastLI){ctx.fillStyle=lut[li]??lut[0];lastLI=li;}
        if(useCA){ctx.translate(dx+rs*.3,dy-rs*.4);ctx.rotate(caR);ctx.fillText(p.ch,-rs*.3,rs*.4);ctx.setTransform(dpr,0,0,dpr,0,0);}
        else ctx.fillText(p.ch,dx,dy);
      }
      ctx.globalAlpha=1;
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); init(); raf = requestAnimationFrame(tick); });
    ro.observe(wrapper);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }} className={className}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
`;
}

// ── Standalone HTML generator ─────────────────────────────────────────────────

function genHTML(s: Settings, map: ImageDensityMap | null): string {
  const pool   = resolvedPool(s);
  const hasMap = s.pattern === "image" && map;
  const cfg    = JSON.stringify({ ...s, charSet: undefined, customChars: undefined });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ASCII Background</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: ${s.bgColor1}; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
<canvas id="ascii"></canvas>
<script>
/* ASCII Art Background — exported ${new Date().toLocaleDateString()} */
(function () {
  const C = ${cfg};
  const POOL = ${JSON.stringify(pool)};
  ${hasMap ? `const DRAW_MAP = ${JSON.stringify(map)};` : "const DRAW_MAP = null;"}

  const hexRgb=h=>{const m=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h.trim());return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[255,255,255]};
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),lerp=(a,b,t)=>a+(b-a)*t;

  function buildLUT(mode,c1,c2,c3,sat){const[r1,g1,b1]=hexRgb(c1),[r2,g2,b2]=mode!=="mono"?hexRgb(c2):[r1,g1,b1],[r3,g3,b3]=mode==="trio"?hexRgb(c3):[r2,g2,b2];return Array.from({length:256},(_,i)=>{const t=i/255;let r,g,b;if(mode==="mono"){r=r1;g=g1;b=b1;}else if(mode==="duo"){r=Math.round(r1+(r2-r1)*t);g=Math.round(g1+(g2-g1)*t);b=Math.round(b1+(b2-b1)*t);}else if(t<.5){const u=t*2;r=Math.round(r1+(r2-r1)*u);g=Math.round(g1+(g2-g1)*u);b=Math.round(b1+(b2-b1)*u);}else{const u=(t-.5)*2;r=Math.round(r2+(r3-r2)*u);g=Math.round(g2+(g3-g2)*u);b=Math.round(b2+(b3-b2)*u);}if(sat!==1){const lm=.299*r+.587*g+.114*b;r=clamp(Math.round(lm+(r-lm)*sat),0,255);g=clamp(Math.round(lm+(g-lm)*sat),0,255);b=clamp(Math.round(lm+(b-lm)*sat),0,255);}return \`#\${r.toString(16).padStart(2,"0")}\${g.toString(16).padStart(2,"0")}\${b.toString(16).padStart(2,"0")}\`});}

  const h21=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
  const vN=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy),a=h21(ix,iy),b=h21(ix+1,iy),c=h21(ix,iy+1),d=h21(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(d-b-c+a)*ux*uy};
  const fbm=(x,y,o=5)=>{let v=0,amp=.5,f=1,s=0;for(let i=0;i<o;i++){v+=vN(x*f,y*f)*amp;s+=amp;amp*=.5;f*=2;}return v/s};
  const cellChar=(c,r)=>{const h=Math.abs(Math.sin(c*127.1+r*311.7)*43758.5453);return POOL[Math.floor((h-Math.floor(h))*POOL.length)]};
  const pickChar=()=>POOL[Math.floor(Math.random()*POOL.length)];

  function drawFlat(ctx,w,h,lut,dm){
    if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}else ctx.fillStyle=C.bgColor1;
    ctx.fillRect(0,0,w,h);
    const sf=C.zoom/100,sp=clamp(C.speed,.2,3),px=Math.round(C.baseSize*sf),cW=C.baseSize*1.1*sf*sp,cH=C.baseSize*1.6*sf*sp,vC=Math.ceil(w/cW)+1,vR=Math.ceil(h/cH)+1,nsx=2/Math.max(1,vC),nsy=2/Math.max(1,vR),thr=lerp(.65,.22,(C.density-.4)/1.6),aRad=C.angle*Math.PI/180,caR=C.charAngle*Math.PI/180,useCA=Math.abs(caR)>.001,diag=Math.sqrt(w*w+h*h),pC=Math.ceil((diag-w)/2/cW)+2,pR=Math.ceil((diag-h)/2/cH)+2,ccx=vC/2,ccy=vR/2;let lf="";
    ctx.font=\`\${px}px 'Courier New',monospace\`;ctx.save();
    if(Math.abs(aRad)>.001){ctx.translate(w/2,h/2);ctx.rotate(aRad);ctx.translate(-w/2,-h/2);}
    for(let row=-pR;row<vR+pR;row++){for(let col=-pC;col<vC+pC;col++){
      let str;if(dm){const mx=clamp(Math.floor((col/vC)*dm.w),0,dm.w-1),my=clamp(Math.floor((row/vR)*dm.h),0,dm.h-1),val=dm.data[my*dm.w+mx]??0;if(val<.04)continue;str=val;}else{const n=fbm(col*nsx,row*nsy);if(n<thr)continue;str=(n-thr)/(1-thr);}
      let tG;switch(C.gradientDir){case"horizontal":tG=clamp(col/vC,0,1);break;case"vertical":tG=clamp(row/vR,0,1);break;case"radial":{const dx=(col-ccx)/(vC*.5),dy=(row-ccy)/(vR*.5);tG=clamp(Math.sqrt(dx*dx+dy*dy)/Math.SQRT2,0,1);break;}default:tG=clamp((col/vC)*.5+(row/vR)*.5,0,1);}
      const fill=lut[Math.round(tG*255)]??lut[0],op=clamp((str*.35+.75)*C.colorOpacity,.02,1);
      if(useCA){const tx=col*cW+px*.3,ty=row*cH+px*.45;ctx.save();ctx.globalAlpha=op;ctx.fillStyle=fill;ctx.translate(tx,ty);ctx.rotate(caR);ctx.fillText(cellChar(col,row),-px*.3,px*.45);ctx.restore();}
      else{if(fill!==lf){ctx.fillStyle=fill;lf=fill;}ctx.globalAlpha=op;ctx.fillText(cellChar(col,row),col*cW,row*cH+px);}
    }}
    ctx.restore();ctx.globalAlpha=1;
  }

  function buildClusters(w,h){const d=C.density,mg=60,cls=[],cnt=Math.round(10+d*3),minD=Math.min(w,h)*.13;for(let i=0;i<cnt;i++){let ok=false;for(let a=0;a<60;a++){const cx=mg+Math.random()*(w-2*mg),cy=mg+Math.random()*(h-2*mg);if(cls.every(e=>Math.hypot(cx-e.bx,cy-e.by)>=minD)){const r=70+Math.random()*160;cls.push({x:cx,y:cy,bx:cx,by:cy,r,ph:Math.random()*Math.PI*2,sp:.00012+Math.random()*.0003,ax:25+Math.random()*55,ay:18+Math.random()*42,pc:clamp(Math.floor(r*r*.03*d),80,500)});ok=true;break;}}if(!ok){const r=60+Math.random()*100,cx=mg+Math.random()*(w-2*mg),cy=mg+Math.random()*(h-2*mg);cls.push({x:cx,y:cy,bx:cx,by:cy,r,ph:Math.random()*Math.PI*2,sp:.00012+Math.random()*.0003,ax:20+Math.random()*40,ay:15+Math.random()*30,pc:clamp(Math.floor(r*r*.03*d),50,300)});}}const max=Math.floor(4000*Math.min(d,2)),tot=cls.reduce((s,c)=>s+c.pc,0);if(tot>max){const sc=max/tot;for(const c of cls)c.pc=Math.max(8,Math.floor(c.pc*sc));}return cls;}
  function buildParticles(cls,now){const ps=[];for(const c of cls){for(let i=0;i<c.pc;i++){const ang=Math.random()*Math.PI*2,u1=Math.max(Math.random(),1e-9),u2=Math.random(),g=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2),r=Math.min(Math.abs(g)*.42,1)*c.r,dn=r/c.r,nt=clamp(1-dn,0,1),bx=c.bx+Math.cos(ang)*r,by=c.by+Math.sin(ang)*r;ps.push({x:bx,y:by,bx,by,z:(Math.random()-.5)*600,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.09,ch:pickChar(),fs:Math.round(clamp(lerp(22,7,dn*dn)+(Math.random()-.5)*2,7,22)),nt,op:clamp(lerp(.88,.08,dn)*(.55+Math.random()*.45),.06,.92),px:Math.random()*Math.PI*2,py:Math.random()*Math.PI*2,fx:.0003+Math.random()*.0005,fy:.0002+Math.random()*.0004,ax:4+Math.random()*15,ay:3+Math.random()*12,rt:now+8000+Math.random()*7000});}}ps.sort((a,b)=>a.fs-b.fs);return ps;}

  const canvas=document.getElementById("ascii"),ctx=canvas.getContext("2d"),dpr=Math.min(window.devicePixelRatio||1,2);
  let raf=0,lut=[],clusters=[],particles=[],flatKey="",lastFS=-1,lastLI=-1;

  function init(){canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);lut=buildLUT(C.colorMode,C.color1,C.color2,C.color3,C.colorSaturation);flatKey="";if(C.dimension==="3d"){clusters=buildClusters(innerWidth,innerHeight);particles=buildParticles(clusters,performance.now());}}
  init();

  function tick(ts){
    const w=innerWidth,h=innerHeight;
    if(C.dimension==="flat"){const k=[w,h,C.baseSize,C.density,C.zoom,C.speed,C.angle,C.charAngle,C.gradientDir,C.colorMode,C.color1,C.color2,C.color3,C.colorOpacity,C.colorSaturation,C.bgMode,C.bgColor1,C.bgColor2].join("|");if(k!==flatKey){flatKey=k;drawFlat(ctx,w,h,lut,DRAW_MAP);}raf=requestAnimationFrame(tick);return;}
    const{speed,baseSize,minSize,sizeRange,zoom,colorOpacity}=C,focal=500,cx=w/2,cy=h/2,aOff=C.angle*Math.PI/180,caR=C.charAngle*Math.PI/180,useCA=Math.abs(caR)>.001,rotA=ts*.00004*speed+aOff,cosA=Math.cos(rotA),sinA=Math.sin(rotA),zf=zoom/100;
    if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}else ctx.fillStyle=C.bgColor1;
    ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;lastFS=-1;lastLI=-1;
    for(const c of clusters){c.x=c.bx+Math.sin(ts*c.sp*speed+c.ph)*c.ax;c.y=c.by+Math.cos(ts*c.sp*speed*.7+c.ph)*c.ay;}
    for(const p of particles){
      p.bx+=p.vx*speed;p.by+=p.vy*speed;const mg=50;if(p.bx<-mg)p.bx+=w+mg*2;else if(p.bx>w+mg)p.bx-=w+mg*2;if(p.by<-mg)p.by+=h+mg*2;else if(p.by>h+mg)p.by-=h+mg*2;
      p.x=p.bx+Math.sin(ts*p.fx*speed+p.px)*p.ax;p.y=p.by+Math.cos(ts*p.fy*speed+p.py)*p.ay;
      if(ts>=p.rt){p.ch=pickChar();p.rt=ts+8000+Math.random()*7000;}
      const relX=p.x-cx,rotX=relX*cosA-p.z*sinA,rotZ=relX*sinA+p.z*cosA,depth=focal+rotZ,sc=focal/Math.max(depth,50);let dx=cx+rotX*sc,dy=cy+(p.y-cy)*sc;
      const bFS=sizeRange?lerp(minSize,baseSize,p.nt):baseSize,dFS=Math.max(4,bFS*sc),dA=clamp(p.op*Math.min(1.5,sc*1.1)*colorOpacity,.02,1);
      dx=cx+(dx-cx)*zf;dy=cy+(dy-cy)*zf;
      let tG;switch(C.gradientDir){case"horizontal":tG=clamp(dx/w,0,1);break;case"vertical":tG=clamp(dy/h,0,1);break;case"radial":{const rx=(dx-cx)/(w*.5),ry=(dy-cy)/(h*.5);tG=clamp(Math.sqrt(rx*rx+ry*ry)/Math.SQRT2,0,1);break;}default:tG=clamp((dx/w)*.5+(dy/h)*.5,0,1);}
      const li=Math.round(tG*255),rs=Math.round(dFS);
      if(rs!==lastFS){ctx.font=\`\${rs}px 'Courier New',monospace\`;lastFS=rs;}
      ctx.globalAlpha=dA;if(li!==lastLI){ctx.fillStyle=lut[li]??lut[0];lastLI=li;}
      if(useCA){ctx.translate(dx+rs*.3,dy-rs*.4);ctx.rotate(caR);ctx.fillText(p.ch,-rs*.3,rs*.4);ctx.setTransform(dpr,0,0,dpr,0,0);}else ctx.fillText(p.ch,dx,dy);
    }
    ctx.globalAlpha=1;raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
  window.addEventListener("resize",()=>{cancelAnimationFrame(raf);init();raf=requestAnimationFrame(tick);});
})();
</script>
</body>
</html>
`;
}

// ── Modal component ───────────────────────────────────────────────────────────

interface Props {
  settings: Settings;
  imageMap: ImageDensityMap | null;
  onClose:  () => void;
}

export function ExportModal({ settings, imageMap, onClose }: Props) {
  const [tab,     setTab]     = useState<"react" | "html">("react");
  const [copied,  setCopied]  = useState(false);

  const code = useMemo(
    () => tab === "react" ? genReact(settings, imageMap) : genHTML(settings, imageMap),
    [tab, settings, imageMap]
  );

  const filename = tab === "react" ? "AsciiBackground.tsx" : "ascii-background.html";

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const TAB_ACTIVE   = { background: "#18182a", color: "#fff", borderBottom: "2px solid #4a6cf7" };
  const TAB_INACTIVE = { background: "transparent", color: "rgba(255,255,255,0.45)", borderBottom: "2px solid transparent" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        width: "min(780px, 94vw)", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        background: "#0e0e1e", borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.13)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        overflow: "hidden", fontFamily: FONT,
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0", flexShrink: 0 }}>
          <div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>Export Background</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 3 }}>
              Self-contained — drop it into your project, no extra installs needed.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: "14px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          {(["react", "html"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", border: "none", cursor: "pointer",
              borderRadius: "6px 6px 0 0", fontFamily: FONT, fontSize: 12, fontWeight: 500,
              letterSpacing: "0.04em", transition: "color 0.15s",
              ...(tab === t ? TAB_ACTIVE : TAB_INACTIVE),
            }}>
              {t === "react" ? "⚛ React / Next.js (.tsx)" : "🌐 Standalone HTML (.html)"}
            </button>
          ))}
        </div>

        {/* Description */}
        <div style={{ padding: "10px 20px 0", color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.6, flexShrink: 0 }}>
          {tab === "react"
            ? <><strong style={{ color: "rgba(255,255,255,0.7)" }}>React / Next.js:</strong> Save as <code style={codeStyle}>AsciiBackground.tsx</code>, then <code style={codeStyle}>import {"{ AsciiBackground }"} from "./AsciiBackground"</code>. Add <code style={codeStyle}>"use client"</code> is already included for Next.js App Router.</>
            : <><strong style={{ color: "rgba(255,255,255,0.7)" }}>Standalone HTML:</strong> Open directly in a browser, or paste the <code style={codeStyle}>&lt;canvas&gt;</code> + <code style={codeStyle}>&lt;script&gt;</code> tags into any existing HTML page. Zero dependencies.</>
          }
        </div>

        {/* Code block */}
        <div style={{ flex: 1, overflowY: "auto", margin: "12px 20px", borderRadius: 8, background: "#07070f", border: "1px solid rgba(255,255,255,0.08)", minHeight: 0 }}>
          <pre style={{ margin: 0, padding: "14px 16px", fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.55, color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {code}
          </pre>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "0 20px 18px", flexShrink: 0 }}>
          <button onClick={copy} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer",
            background: copied ? "#2d6a2d" : "#4a6cf7",
            color: "#fff", fontFamily: FONT, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em",
            transition: "background 0.2s",
          }}>
            {copied ? "✓ Copied!" : "Copy to Clipboard"}
          </button>
          <button onClick={download} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.8)", fontFamily: FONT, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em",
          }}>
            Download {filename}
          </button>
        </div>
      </div>
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", borderRadius: 3,
  padding: "1px 5px", fontFamily: "'Courier New', monospace", fontSize: 10,
};
