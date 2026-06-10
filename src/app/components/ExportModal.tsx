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

// ─────────────────────────────────────────────────────────────────────────────
// Code generators — every function is a direct transcript of AsciiBackground.tsx
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared rendering utilities.
 * When ts=true, emits TypeScript type annotations (for React/.tsx export).
 * When ts=false (default), emits plain JavaScript (for HTML export).
 */
function sharedUtils(ts: boolean = false): string {
  // Helpers: ty() adds ": type" param annotation; rt() adds ": type" return annotation
  const ty = (t: string) => ts ? `: ${t}` : "";
  const rt = (t: string) => ts ? `: ${t}` : "";

  return `
// ── Utilities ──────────────────────────────────────────────────────────────
const hexRgb = (h${ty("string")})${rt("number[]")} => {
  const m = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h.trim());
  return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : [255,255,255];
};
const clamp = (v${ty("number")},lo${ty("number")},hi${ty("number")})${rt("number")} => Math.max(lo,Math.min(hi,v));
const lerp  = (a${ty("number")},b${ty("number")},t${ty("number")})${rt("number")} => a+(b-a)*t;

// ── Gradient LUT (256 colour stops) ────────────────────────────────────────
function buildLUT(mode${ty("string")},c1${ty("string")},c2${ty("string")},c3${ty("string")},sat${ty("number")})${rt("string[]")} {
  const [r1,g1,b1]=hexRgb(c1);
  const [r2,g2,b2]=mode!=="mono"?hexRgb(c2):[r1,g1,b1];
  const [r3,g3,b3]=mode==="trio"?hexRgb(c3):[r2,g2,b2];
  return Array.from({length:256}${ts ? " as ArrayLike<unknown>" : ""},(_,i)=>{
    const t=i/255;
    let r${ty("number")},g${ty("number")},b${ty("number")};
    if(mode==="mono"){r=r1;g=g1;b=b1;}
    else if(mode==="duo"){r=Math.round(r1+(r2-r1)*t);g=Math.round(g1+(g2-g1)*t);b=Math.round(b1+(b2-b1)*t);}
    else if(t<0.5){const u=t*2;r=Math.round(r1+(r2-r1)*u);g=Math.round(g1+(g2-g1)*u);b=Math.round(b1+(b2-b1)*u);}
    else{const u=(t-0.5)*2;r=Math.round(r2+(r3-r2)*u);g=Math.round(g2+(g3-g2)*u);b=Math.round(b2+(b3-b2)*u);}
    if(sat!==1){const lm=0.299*r+0.587*g+0.114*b;r=clamp(Math.round(lm+(r-lm)*sat),0,255);g=clamp(Math.round(lm+(g-lm)*sat),0,255);b=clamp(Math.round(lm+(b-lm)*sat),0,255);}
    return \`#\${r.toString(16).padStart(2,"0")}\${g.toString(16).padStart(2,"0")}\${b.toString(16).padStart(2,"0")}\`;
  });
}

// ── Value noise ─────────────────────────────────────────────────────────────
const h21 = (x${ty("number")},y${ty("number")})${rt("number")} => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
const vN  = (x${ty("number")},y${ty("number")})${rt("number")} => {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
  const a=h21(ix,iy),b=h21(ix+1,iy),c=h21(ix,iy+1),d=h21(ix+1,iy+1);
  return a+(b-a)*ux+(c-a)*uy+(d-b-c+a)*ux*uy;
};
const fbm = (x${ty("number")},y${ty("number")},o${ty("number")} = 5)${rt("number")} => { let v=0,amp=0.5,f=1,s=0; for(let i=0;i<o;i++){v+=vN(x*f,y*f)*amp;s+=amp;amp*=0.5;f*=2;} return v/s; };

// ── Character helpers ───────────────────────────────────────────────────────
const cellChar = (col${ty("number")},row${ty("number")})${rt("string")} => { const h=Math.abs(Math.sin(col*127.1+row*311.7)*43758.5453); return POOL[Math.floor((h-Math.floor(h))*POOL.length)] ?? POOL[0]; };
const pickChar  = ()${rt("string")} => POOL[Math.floor(Math.random()*POOL.length)] ?? POOL[0];

// ── Telephone-keypad grid (12 positions, normalised 0–1) ────────────────────
const KEYPAD${ts ? ": [number,number][]" : ""} = [
  [0.25,0.20],[0.50,0.20],[0.75,0.20],
  [0.25,0.40],[0.50,0.40],[0.75,0.40],
  [0.25,0.60],[0.50,0.60],[0.75,0.60],
  [0.25,0.80],[0.50,0.80],[0.75,0.80],
];

// ── Per-cell strength (0 = skip) — image density map takes priority ──────────
function flatStrength(col${ty("number")},row${ty("number")},vC${ty("number")},vR${ty("number")},nsx${ty("number")},nsy${ty("number")},dm${ty("DMap|null")})${rt("number")} {
  if(dm && C.pattern==="image"){
    const mx=clamp(Math.floor((col/vC)*dm.w),0,dm.w-1);
    const my=clamp(Math.floor((row/vR)*dm.h),0,dm.h-1);
    const v=dm.data[my*dm.w+mx]??0;
    return v<0.04?0:v;
  }
  const nx=col/vC, ny=row/vR;
  const dt=(C.density-0.4)/1.6;
  switch(C.pattern){
    case"organic":{
      const thr=lerp(0.65,0.22,dt), n=fbm(col*nsx,row*nsy);
      return n<thr?0:(n-thr)/(1-thr);
    }
    case"grid":{
      const gC=Math.round(5+C.density*3),gR=Math.round(4+C.density*2);
      const fx=((nx*gC)%1+1)%1,fy=((ny*gR)%1+1)%1;
      const dX=Math.min(fx,1-fx)*2,dY=Math.min(fy,1-fy)*2;
      const d=Math.sqrt(dX*dX+dY*dY),r=lerp(0.38,0.70,dt);
      return d>r?0:(r-d)/r;
    }
    case"dots":{
      let mx=0;
      for(const[fx,fy]of KEYPAD){const d=Math.hypot(nx-fx,ny-fy),r=lerp(0.09,0.16,dt),sv=clamp(1-d/r,0,1);if(sv>mx)mx=sv;}
      return mx;
    }
    case"lines":{
      const lc=Math.round(3+C.density*3);
      let mx=0;
      for(let l=0;l<lc;l++){const wy=(l+0.5)/lc+Math.sin(nx*Math.PI*4+l*1.3)*0.04,d=Math.abs(ny-wy),w=lerp(0.030,0.072,dt),sv=clamp(1-d/w,0,1);if(sv>mx)mx=sv;}
      return mx;
    }
    case"image":{
      // Fallback when no density map: organic noise
      const thr=lerp(0.65,0.22,dt), n=fbm(col*nsx,row*nsy);
      return n<thr?0:(n-thr)/(1-thr);
    }
    default:return 0;
  }
}

// ── Flat (static) renderer ──────────────────────────────────────────────────
function drawFlat(ctx${ty("CanvasRenderingContext2D")},w${ty("number")},h${ty("number")},lut${ty("string[]")},dm${ty("DMap|null")})${rt("void")} {
  if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}
  else ctx.fillStyle=C.bgColor1;
  ctx.fillRect(0,0,w,h);
  const px=Math.round(C.baseSize), cW=C.baseSize*1.1, cH=C.baseSize*1.6;
  const vC=Math.ceil(w/cW)+1, vR=Math.ceil(h/cH)+1;
  const nsx=2.0/Math.max(1,vC), nsy=2.0/Math.max(1,vR);
  const aRad=C.angle*Math.PI/180, caR=C.charAngle*Math.PI/180, useCA=Math.abs(caR)>0.001;
  const diag=Math.sqrt(w*w+h*h), pC=Math.ceil((diag-w)/2/cW)+2, pR=Math.ceil((diag-h)/2/cH)+2;
  const ccx=vC/2, ccy=vR/2;
  ctx.font=\`\${px}px 'Courier New',monospace\`;
  let lf="";
  ctx.save();
  if(Math.abs(aRad)>0.001){ctx.translate(w/2,h/2);ctx.rotate(aRad);ctx.translate(-w/2,-h/2);}
  for(let row=-pR;row<vR+pR;row++){
    for(let col=-pC;col<vC+pC;col++){
      const str=flatStrength(col,row,vC,vR,nsx,nsy,dm);
      if(!str)continue;
      let tG${ty("number")};
      switch(C.gradientDir){
        case"horizontal":tG=clamp(col/vC,0,1);break;
        case"vertical":  tG=clamp(row/vR,0,1);break;
        case"radial":{const dx=(col-ccx)/(vC*0.5),dy=(row-ccy)/(vR*0.5);tG=clamp(Math.sqrt(dx*dx+dy*dy)/Math.SQRT2,0,1);break;}
        default:         tG=clamp((col/vC)*0.5+(row/vR)*0.5,0,1);
      }
      const fill=lut[Math.round(tG*255)]??lut[0];
      const op=clamp((str*0.35+0.75)*C.colorOpacity,0.02,1);
      if(useCA){
        const tx=col*cW+px*0.3,ty=row*cH+px*0.45;
        ctx.save();ctx.globalAlpha=op;ctx.fillStyle=fill${ts ? " as string" : ""};
        ctx.translate(tx,ty);ctx.rotate(caR);
        ctx.fillText(cellChar(col,row),-px*0.3,px*0.45);
        ctx.restore();
      }else{
        if(fill!==lf){ctx.fillStyle=fill${ts ? " as string" : ""};lf=fill${ts ? " as string" : ""};}
        ctx.globalAlpha=op;
        ctx.fillText(cellChar(col,row),col*cW,row*cH+px);
      }
    }
  }
  ctx.restore();ctx.globalAlpha=1;
}

// ── Animated-flat renderer (Live mode) ──────────────────────────────────────
function drawFlatAnim(ctx${ty("CanvasRenderingContext2D")},w${ty("number")},h${ty("number")},lut${ty("string[]")},ts${ty("number")},dm${ty("DMap|null")})${rt("void")} {
  if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}
  else ctx.fillStyle=C.bgColor1;
  ctx.fillRect(0,0,w,h);
  const px=Math.round(C.baseSize), cW=C.baseSize*1.1, cH=C.baseSize*1.6;
  const vC=Math.ceil(w/cW)+1, vR=Math.ceil(h/cH)+1;
  const nsx=2.0/Math.max(1,vC), nsy=2.0/Math.max(1,vR);
  const aRad=C.angle*Math.PI/180, caR=C.charAngle*Math.PI/180, useCA=Math.abs(caR)>0.001;
  const diag=Math.sqrt(w*w+h*h), pC=Math.ceil((diag-w)/2/cW)+2, pR=Math.ceil((diag-h)/2/cH)+2;
  const ccx=vC/2, ccy=vR/2;
  const t=ts*0.001;
  ctx.font=\`\${px}px 'Courier New',monospace\`;
  let lf="";
  ctx.save();
  if(Math.abs(aRad)>0.001){ctx.translate(w/2,h/2);ctx.rotate(aRad);ctx.translate(-w/2,-h/2);}
  for(let row=-pR;row<vR+pR;row++){
    for(let col=-pC;col<vC+pC;col++){
      const str=flatStrength(col,row,vC,vR,nsx,nsy,dm);
      if(!str)continue;
      const nx=col/vC, ny=row/vR;
      let animOp=1, odx=0, ody=0;
      switch(C.pattern){
        case"organic":{
          const fa=Math.sin(t*0.14)*Math.PI*0.75;
          const spat=col*0.22+row*0.08, wv=Math.sin(spat-t*1.9), sw=Math.sin(col*0.09+row*0.14+t*0.6)*0.45;
          odx=Math.cos(fa)*wv*cW*0.70; ody=Math.sin(fa)*wv*cH*0.55+sw*cH*0.35;
          animOp=0.22+0.78*(0.5+0.5*Math.sin(spat-t*1.5));
          break;
        }
        case"grid":{
          const gC=Math.round(5+C.density*3),gR=Math.round(4+C.density*2);
          const gCol=Math.round(nx*gC), gRow=Math.round(ny*gR);
          const cur=Math.sin(t*1.3-gCol*0.55+gRow*0.18);
          odx=cur*cW*0.65; ody=-Math.max(0,cur)*cH*1.1;
          animOp=0.38+0.62*(0.5+0.5*cur);
          break;
        }
        case"dots":{
          let cK=0,mD=Infinity;
          for(let k=0;k<KEYPAD.length;k++){const d=Math.hypot(nx-KEYPAD[k][0],ny-KEYPAD[k][1]);if(d<mD){mD=d;cK=k;}}
          const bell=0.5+0.5*Math.sin(t*1.15+cK*0.52);
          const kfx=KEYPAD[cK][0],kfy=KEYPAD[cK][1];
          odx=(nx-kfx)*w*0.10*bell; ody=(ny-kfy)*h*0.07*bell-bell*cH*0.90;
          animOp=0.12+0.88*(1-bell*0.60);
          break;
        }
        case"lines":{
          const swF=1-ny, lc=Math.round(3+C.density*3), sI=Math.floor(ny*lc);
          const sway=Math.sin(t*1.05+sI*0.85+col*0.018);
          odx=sway*cW*swF*3.2; ody=Math.sin(t*0.72+col*0.045)*cH*0.22;
          animOp=0.32+0.68*(0.65+0.35*Math.abs(sway));
          break;
        }
        default:{
          const c1=Math.sin(Math.hypot(nx-(0.3+Math.sin(t*0.28)*0.14),ny-0.38)*18-t*2.0);
          const c2=Math.sin(Math.hypot(nx-(0.70+Math.cos(t*0.22)*0.12),ny-0.62)*22-t*1.65);
          const c3=Math.sin(Math.hypot(nx-0.5,ny-(0.5+Math.sin(t*0.18)*0.20))*15-t*2.3)*0.6;
          animOp=0.12+0.88*(0.5+0.5*clamp((c1+c2+c3)/2.6,-1,1));
          break;
        }
      }
      let tG${ty("number")};
      switch(C.gradientDir){
        case"horizontal":tG=clamp(col/vC,0,1);break;
        case"vertical":  tG=clamp(row/vR,0,1);break;
        case"radial":{const rdx=(col-ccx)/(vC*0.5),rdy=(row-ccy)/(vR*0.5);tG=clamp(Math.sqrt(rdx*rdx+rdy*rdy)/Math.SQRT2,0,1);break;}
        default:         tG=clamp((col/vC)*0.5+(row/vR)*0.5,0,1);
      }
      const fill=lut[Math.round(tG*255)]??lut[0];
      const op=clamp((str*0.35+0.75)*animOp*C.colorOpacity,0.02,1);
      if(useCA){
        const tx=col*cW+odx+px*0.3,ty=row*cH+ody+px*0.45;
        ctx.save();ctx.globalAlpha=op;ctx.fillStyle=fill${ts ? " as string" : ""};
        ctx.translate(tx,ty);ctx.rotate(caR);
        ctx.fillText(cellChar(col,row),-px*0.3,px*0.45);
        ctx.restore();
      }else{
        if(fill!==lf){ctx.fillStyle=fill${ts ? " as string" : ""};lf=fill${ts ? " as string" : ""};}
        ctx.globalAlpha=op;
        ctx.fillText(cellChar(col,row),col*cW+odx,row*cH+ody+px);
      }
    }
  }
  ctx.restore();ctx.globalAlpha=1;
}

// ── 3-D cluster helpers ─────────────────────────────────────────────────────
function mkCluster(x${ty("number")},y${ty("number")},r${ty("number")},pc${ty("number")},ax${ty("number")},ay${ty("number")})${rt("Cluster")} {
  return{x,y,bx:x,by:y,r,ph:Math.random()*Math.PI*2,sp:0.00012+Math.random()*0.0003,ax,ay,pc:Math.max(8,Math.floor(pc))};
}
function capPC(cls${ty("Cluster[]")})${rt("void")} {
  const max=Math.floor(4000*Math.min(C.density,2)), tot=cls.reduce((s,c)=>s+c.pc,0);
  if(tot>max){const sc=max/tot;for(const c of cls)c.pc=Math.max(8,Math.floor(c.pc*sc));}
}

// ── Pattern-specific cluster builders ───────────────────────────────────────
function buildOrgClusters(w${ty("number")},h${ty("number")})${rt("Cluster[]")} {
  const d=C.density, mg=60, cls${ty("Cluster[]")}=[], cnt=Math.round(10+d*3), minD=Math.min(w,h)*0.13;
  for(let i=0;i<cnt;i++){
    let ok=false;
    for(let a=0;a<60;a++){
      const cx=mg+Math.random()*(w-2*mg), cy=mg+Math.random()*(h-2*mg);
      if(cls.every(e=>Math.hypot(cx-e.bx,cy-e.by)>=minD)){
        const r=70+Math.random()*160;
        cls.push(mkCluster(cx,cy,r,clamp(Math.floor(r*r*0.03*d),80,500),25+Math.random()*55,18+Math.random()*42));
        ok=true;break;
      }
    }
    if(!ok){const r=60+Math.random()*100;cls.push(mkCluster(mg+Math.random()*(w-2*mg),mg+Math.random()*(h-2*mg),r,clamp(Math.floor(r*r*0.03*d),50,300),20+Math.random()*40,15+Math.random()*30));}
  }
  capPC(cls);return cls;
}
function buildGridClusters(w${ty("number")},h${ty("number")})${rt("Cluster[]")} {
  const d=C.density, cols=Math.round(4+d*2), rows=Math.round(3+d*1.5), cls${ty("Cluster[]")}=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const cx=(c+0.5)/cols*w+(Math.random()-0.5)*28, cy=(r+0.5)/rows*h+(Math.random()-0.5)*20;
    cls.push(mkCluster(cx,cy,38+Math.random()*38,clamp(Math.floor(90*d),50,220),10+Math.random()*18,8+Math.random()*14));
  }
  capPC(cls);return cls;
}
function buildDotClusters(w${ty("number")},h${ty("number")})${rt("Cluster[]")} {
  const d=C.density, cls${ty("Cluster[]")}=[], step=clamp(Math.min(w,h)*0.09,45,130);
  for(const[ox,oy]of[[w*0.25,h*0.35],[w*0.75,h*0.65],[w*0.5,h*0.5],[w*0.15,h*0.72],[w*0.85,h*0.28]]){
    cls.push(mkCluster(ox,oy,28+Math.random()*20,clamp(Math.floor(90*d),40,180),8+Math.random()*12,6+Math.random()*10));
    const rings=Math.round(2+d*1.5);
    for(let ring=1;ring<=rings;ring++){
      const pts=Math.max(4,Math.round(ring*5));
      for(let p=0;p<pts;p++){
        const ang=p/pts*Math.PI*2, cx=ox+Math.cos(ang)*ring*step, cy=oy+Math.sin(ang)*ring*step;
        if(cx>=0&&cx<=w&&cy>=0&&cy<=h)cls.push(mkCluster(cx,cy,18+Math.random()*22,clamp(Math.floor(55*d),25,130),6+Math.random()*10,5+Math.random()*8));
      }
    }
  }
  capPC(cls);return cls;
}
function buildLineClusters(w${ty("number")},h${ty("number")})${rt("Cluster[]")} {
  const d=C.density, lc=Math.round(4+d*2), cls${ty("Cluster[]")}=[];
  for(let l=0;l<lc;l++){
    const y0=(l+0.5)/lc*h, amp=25+Math.random()*70, freq=0.003+Math.random()*0.005, phase=Math.random()*Math.PI*2, pts=Math.round(7+d*5);
    for(let p=0;p<pts;p++){const cx=(p+0.5)/pts*w;cls.push(mkCluster(cx,y0+Math.sin(cx*freq+phase)*amp,16+Math.random()*22,clamp(Math.floor(75*d),28,160),5+Math.random()*8,18+Math.random()*30));}
  }
  capPC(cls);return cls;
}`;
}

/**
 * Image cluster builder + dispatcher.
 * hasMap: whether DRAW_MAP is a real DMap (controls which arg is passed to buildImageClusters).
 * ts: whether to emit TypeScript type annotations.
 */
function clusterDispatch(hasMap: boolean, ts: boolean = false): string {
  const ty = (t: string) => ts ? `: ${t}` : "";
  const rt = (t: string) => ts ? `: ${t}` : "";
  const dmArg = "DRAW_MAP"; // DRAW_MAP is always declared (null when no map)
  return `
// ── Image cluster builder ───────────────────────────────────────────────────
function buildImageClusters(dm${ty("DMap|null")},w${ty("number")},h${ty("number")})${rt("Cluster[]")} {
  if(!dm)return buildOrgClusters(w,h);
  const d=C.density, cls${ty("Cluster[]")}=[];
  for(let y=0;y<dm.h;y++)for(let x=0;x<dm.w;x++){
    const v=dm.data[y*dm.w+x]??0;
    if(v>0.18&&Math.random()<v*0.8){
      const cx=(x+0.5)/dm.w*w, cy=(y+0.5)/dm.h*h, r=14+v*48;
      cls.push(mkCluster(cx,cy,r,v*75*d,5+v*20,4+v*15));
    }
  }
  if(cls.length===0)return buildOrgClusters(w,h);
  capPC(cls);return cls;
}

// ── Pattern dispatcher ──────────────────────────────────────────────────────
function buildClusters(w${ty("number")},h${ty("number")})${rt("Cluster[]")} {
  switch(C.pattern){
    case"grid":  return buildGridClusters(w,h);
    case"dots":  return buildDotClusters(w,h);
    case"lines": return buildLineClusters(w,h);
    case"image": return buildImageClusters(${dmArg},w,h);
    default:     return buildOrgClusters(w,h);
  }
}

// ── Particle builder ────────────────────────────────────────────────────────
function buildParticles(cls${ty("Cluster[]")},now${ty("number")})${rt("Particle[]")} {
  const ps${ty("Particle[]")}=[];
  for(const c of cls){
    for(let i=0;i<c.pc;i++){
      const ang=Math.random()*Math.PI*2;
      const u1=Math.max(Math.random(),1e-9), u2=Math.random();
      const g=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
      const r=Math.min(Math.abs(g)*0.42,1)*c.r;
      const dn=r/c.r, normT=clamp(1-dn,0,1);
      const bx=c.bx+Math.cos(ang)*r, by=c.by+Math.sin(ang)*r;
      ps.push({
        x:bx,y:by,bx,by,
        z:(Math.random()-0.5)*600,
        vx:(Math.random()-0.5)*0.12, vy:(Math.random()-0.5)*0.09,
        ch:pickChar(),
        fs:Math.round(clamp(lerp(22,7,dn*dn)+(Math.random()-0.5)*2,7,22)),
        normT,
        op:clamp(lerp(0.88,0.08,dn)*(0.55+Math.random()*0.45),0.06,0.92),
        phX:Math.random()*Math.PI*2, phY:Math.random()*Math.PI*2,
        frX:0.0003+Math.random()*0.0005, frY:0.0002+Math.random()*0.0004,
        aX:4+Math.random()*15, aY:3+Math.random()*12,
        rt:now+8000+Math.random()*7000
      });
    }
  }
  ps.sort((a,b)=>a.fs-b.fs);
  return ps;
}`;
}

/** The 3-D particle render loop, shared by both generators. */
function render3D(dprVar: string): string {
  return `
    // ── 3-D ──────────────────────────────────────────────────────────────
    {
      const{speed,baseSize,minSize,sizeRange,colorOpacity}=C;
      const focal=500, cx=w/2, cy=h/2;
      const aOff=C.angle*Math.PI/180, caR=C.charAngle*Math.PI/180, useCA=Math.abs(caR)>0.001;
      const rotA=motionTs*0.00004+aOff, cosA=Math.cos(rotA), sinA=Math.sin(rotA);
      if(C.bgMode==="gradient"){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,C.bgColor1);g.addColorStop(1,C.bgColor2);ctx.fillStyle=g;}
      else ctx.fillStyle=C.bgColor1;
      ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
      let lastFS=-1,lastLI=-1;
      for(const c of clusters){c.x=c.bx+Math.sin(motionTs*c.sp+c.ph)*c.ax;c.y=c.by+Math.cos(motionTs*c.sp*0.7+c.ph)*c.ay;}
      for(const p of particles){
        p.bx+=p.vx*frameStep*speed;p.by+=p.vy*frameStep*speed;
        const mg=50;
        if(p.bx<-mg)p.bx+=w+mg*2;else if(p.bx>w+mg)p.bx-=w+mg*2;
        if(p.by<-mg)p.by+=h+mg*2;else if(p.by>h+mg)p.by-=h+mg*2;
        p.x=p.bx+Math.sin(motionTs*p.frX+p.phX)*p.aX;
        p.y=p.by+Math.cos(motionTs*p.frY+p.phY)*p.aY;
        if(ts>=p.rt){p.ch=pickChar();p.rt=ts+8000+Math.random()*7000;}
        const relX=p.x-cx,rotX=relX*cosA-p.z*sinA,rotZ=relX*sinA+p.z*cosA;
        const depth=focal+rotZ,sc=focal/Math.max(depth,50);
        let dx=cx+rotX*sc,dy=cy+(p.y-cy)*sc;
        const depthT=sizeRange?clamp((sc-0.5)/1.5,0,1):1;
        const dFS=Math.max(4,lerp(minSize,baseSize,depthT));
        const dA=clamp(p.op*Math.min(1.5,sc*1.1)*colorOpacity,0.02,1);
        let tG;
        switch(C.gradientDir){
          case"horizontal":tG=clamp(dx/w,0,1);break;
          case"vertical":  tG=clamp(dy/h,0,1);break;
          case"radial":{const rx=(dx-cx)/(w*0.5),ry=(dy-cy)/(h*0.5);tG=clamp(Math.sqrt(rx*rx+ry*ry)/Math.SQRT2,0,1);break;}
          default:         tG=clamp((dx/w)*0.5+(dy/h)*0.5,0,1);
        }
        const li=Math.round(tG*255),rs=Math.round(dFS);
        if(rs!==lastFS){ctx.font=\`\${rs}px 'Courier New',monospace\`;lastFS=rs;}
        ctx.globalAlpha=dA;
        if(li!==lastLI){ctx.fillStyle=lut[li]??lut[0];lastLI=li;}
        if(useCA){ctx.translate(dx+rs*0.3,dy-rs*0.4);ctx.rotate(caR);ctx.fillText(p.ch,-rs*0.3,rs*0.4);ctx.setTransform(${dprVar},0,0,${dprVar},0,0);}
        else ctx.fillText(p.ch,dx,dy);
      }
      ctx.globalAlpha=1;
    }`;
}

// ── React / Next.js generator ─────────────────────────────────────────────────

function genReact(s: Settings, map: ImageDensityMap | null): string {
  const pool   = resolvedPool(s);
  const hasMap = !!map;  // serialize density map whenever it exists
  const cfg    = JSON.stringify({ ...s, charSet: undefined, customChars: undefined }, null, 2);

  return `\
"use client";
/**
 * ASCII Art Background — exported ${new Date().toLocaleDateString()}
 *
 * Drop-in React / Next.js component. No external dependencies.
 * Usage:  import { AsciiBackground } from "./AsciiBackground";
 *         <AsciiBackground />                 ← fixed, full-page backdrop (default)
 *         <AsciiBackground fullPage={false} /> ← fills nearest positioned ancestor
 *
 * Dimension: ${s.dimension}  Pattern: ${s.pattern}  Mode: ${s.colorMode}
 */

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

/* ── TypeScript interfaces ──────────────────────────────────────────────── */
interface AsciiConfig {
  dimension: "flat" | "flat-anim" | "3d";
  pattern: "organic" | "grid" | "dots" | "lines" | "image";
  colorMode: "mono" | "duo" | "trio";
  colorOpacity: number; colorSaturation: number;
  color1: string; color2: string; color3: string;
  bgMode: "solid" | "gradient"; bgColor1: string; bgColor2: string;
  density: number; baseSize: number; minSize: number; sizeRange: boolean;
  zoom: number; speed: number; angle: number; charAngle: number;
  gradientDir: "diagonal" | "horizontal" | "vertical" | "radial";
}
interface DMap { data: number[]; w: number; h: number; }
interface Cluster {
  x: number; y: number; bx: number; by: number;
  r: number; ph: number; sp: number; ax: number; ay: number; pc: number;
}
interface Particle {
  x: number; y: number; bx: number; by: number;
  z: number; vx: number; vy: number;
  ch: string; fs: number; normT: number; op: number;
  phX: number; phY: number; frX: number; frY: number;
  aX: number; aY: number; rt: number;
}

/* ── Frozen settings snapshot ───────────────────────────────────────────── */
const C: AsciiConfig = ${cfg.replace(/"([^"]+)":/g, "$1:")} as AsciiConfig;
const POOL: string = ${JSON.stringify(pool)};
const DRAW_MAP: DMap | null = ${hasMap ? JSON.stringify(map) : "null"};
${sharedUtils(true)}
${clusterDispatch(hasMap, true)}

/* ── Component ──────────────────────────────────────────────────────────── */
interface Props {
  /** When true (default) renders position:fixed, inset:0, zIndex:-1 — a full-page backdrop. */
  fullPage?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function AsciiBackground({ fullPage = true, style, className }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas  = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let lastFrameTs = 0;
    let motionTs = 0;
    let lut: string[] = [];
    let clusters: Cluster[] = [];
    let particles: Particle[] = [];
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = mql.matches;

    function init(): void {
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      if (!w || !h) return;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lut = buildLUT(C.colorMode, C.color1, C.color2, C.color3, C.colorSaturation);
      if (C.dimension === "3d") {
        clusters  = buildClusters(w, h);
        particles = buildParticles(clusters, performance.now());
      }
      if (C.dimension === "flat") {
        // Flat mode: draw once here — no animation loop needed
        drawFlat(ctx, w, h, lut, DRAW_MAP);
      } else if (reducedMotion) {
        // Animated modes with reduced motion: one static frame, then stop
        tick(0);
      }
    }
    init();

    const onMQL = (e: MediaQueryListEvent): void => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        cancelAnimationFrame(raf);
        raf = 0;
        if (C.dimension !== "flat") tick(0);
      } else if (!document.hidden) {
        lastFrameTs = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    mql.addEventListener("change", onMQL);
    const onVis = (): void => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (C.dimension !== "flat" && !reducedMotion) { lastFrameTs = 0; raf = requestAnimationFrame(tick); }
    };
    document.addEventListener("visibilitychange", onVis);

    function tick(ts: number): void {
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      if (!w || !h) { raf = requestAnimationFrame(tick); return; }
      const dt = lastFrameTs ? Math.min(64, Math.max(0, ts - lastFrameTs)) : 0;
      lastFrameTs = ts;
      if (C.dimension !== "flat" && !reducedMotion) motionTs += dt * C.speed;
      const frameStep = dt / 16.6667;

      /* ── Live (animated flat) ── */
      if (C.dimension === "flat-anim") {
        drawFlatAnim(ctx, w, h, lut, motionTs, DRAW_MAP);
        if (!reducedMotion) raf = requestAnimationFrame(tick);
        return;
      }

      /* ── 3-D ── */${render3D("dpr")}
      if (!reducedMotion) raf = requestAnimationFrame(tick);
    }

    // Start animation loop only for animated modes
    if (C.dimension !== "flat" && !reducedMotion) {
      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver((): void => {
      cancelAnimationFrame(raf);
      init();
      if (C.dimension !== "flat" && !reducedMotion) { lastFrameTs = 0; raf = requestAnimationFrame(tick); }
    });
    ro.observe(wrapper);

    return (): void => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mql.removeEventListener("change", onMQL);
    };
  }, []);

  const wrapStyle: CSSProperties = fullPage
    ? { position: "fixed", inset: 0, zIndex: -1, overflow: "hidden" }
    : { position: "absolute", inset: 0, overflow: "hidden" };

  return (
    <div ref={wrapperRef} style={{ ...wrapStyle, ...style }} className={className}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
`;
}

// ── Standalone HTML generator ─────────────────────────────────────────────────

function genHTML(s: Settings, map: ImageDensityMap | null): string {
  const pool   = resolvedPool(s);
  const hasMap = !!map;  // serialize density map whenever it exists
  const cfg    = JSON.stringify({ ...s, charSet: undefined, customChars: undefined });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ASCII Background</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{width:100%;height:100%;overflow:hidden;background:${s.bgColor1}}
    canvas{display:block;width:100%;height:100%}
  </style>
</head>
<body>
<canvas id="ascii"></canvas>
<script>
/* ASCII Art Background — exported ${new Date().toLocaleDateString()}
   Dimension: ${s.dimension}  Pattern: ${s.pattern}  Mode: ${s.colorMode} */
(function(){
  const C = ${cfg};
  const POOL = ${JSON.stringify(pool)};
  const DRAW_MAP = ${hasMap ? JSON.stringify(map) : "null"};
${sharedUtils(false)}
${clusterDispatch(hasMap, false)}

  const canvas=document.getElementById("ascii");
  const ctx=canvas.getContext("2d");
  const dpr=Math.min(window.devicePixelRatio||1,2);
  let raf=0,lastFrameTs=0,motionTs=0,lut=[],clusters=[],particles=[];
  // Declare reducedMotion before init() so the static-frame path can read it
  const mql=window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion=mql.matches;

  function init(){
    canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    lut=buildLUT(C.colorMode,C.color1,C.color2,C.color3,C.colorSaturation);
    if(C.dimension==="3d"){
      clusters=buildClusters(innerWidth,innerHeight);
      particles=buildParticles(clusters,performance.now());
    }
    if(C.dimension==="flat"){
      drawFlat(ctx,innerWidth,innerHeight,lut,DRAW_MAP);
    }else if(reducedMotion){
      // Animated modes with reduced motion: one static frame, then stop
      tick(0);
    }
  }
  init();

  mql.addEventListener("change",e=>{reducedMotion=e.matches;if(reducedMotion){cancelAnimationFrame(raf);raf=0;if(C.dimension!=="flat")tick(0);}else if(!document.hidden){lastFrameTs=0;raf=requestAnimationFrame(tick);}});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)cancelAnimationFrame(raf);else if(C.dimension!=="flat"&&!reducedMotion){lastFrameTs=0;raf=requestAnimationFrame(tick);}});
  window.addEventListener("resize",()=>{cancelAnimationFrame(raf);init();if(C.dimension!=="flat"&&!reducedMotion){lastFrameTs=0;raf=requestAnimationFrame(tick);}});

  function tick(ts){
    const w=innerWidth,h=innerHeight;
    const dt=lastFrameTs?Math.min(64,Math.max(0,ts-lastFrameTs)):0;
    lastFrameTs=ts;
    if(C.dimension!=="flat"&&!reducedMotion)motionTs+=dt*C.speed;
    const frameStep=dt/16.6667;

    // Animated flat (Live)
    if(C.dimension==="flat-anim"){
      drawFlatAnim(ctx,w,h,lut,motionTs,DRAW_MAP);
      if(!reducedMotion)raf=requestAnimationFrame(tick);
      return;
    }

    // 3-D${render3D("dpr")}
    if(!reducedMotion)raf=requestAnimationFrame(tick);
  }

  // Start animation loop only for animated modes
  if(C.dimension!=="flat"&&!reducedMotion){lastFrameTs=0;raf=requestAnimationFrame(tick);}
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

function byteSize(str: string) { return new Blob([str]).size; }
function fmtKB(bytes: number)  { return (bytes / 1024).toFixed(1); }

export function ExportModal({ settings, imageMap, onClose }: Props) {
  const [tab,    setTab]    = useState<"react" | "html">("react");
  const [copied, setCopied] = useState(false);

  const sizes = useMemo(() => {
    const r = byteSize(genReact(settings, imageMap));
    const h = byteSize(genHTML(settings, imageMap));
    return { react: r, html: h };
  }, [settings, imageMap]);

  const code = useMemo(
    () => tab === "react" ? genReact(settings, imageMap) : genHTML(settings, imageMap),
    [tab, settings, imageMap]
  );

  const currentKB = fmtKB(tab === "react" ? sizes.react : sizes.html);
  const filename   = tab === "react" ? "AsciiBackground.tsx" : "ascii-background.html";

  function copy() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => copyFallback(code, done));
    } else {
      copyFallback(code, done);
    }
  }

  function copyFallback(text: string, onDone: () => void) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand("copy"); onDone(); } catch {}
    document.body.removeChild(ta);
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

  const dimLabel = settings.dimension === "flat" ? "Flat" : settings.dimension === "flat-anim" ? "Live" : "3D";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        width: "min(800px, 94vw)", maxHeight: "88vh",
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
              Snapshot of current canvas · {dimLabel} · {settings.pattern} · {settings.colorMode}
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
              display: "flex", alignItems: "center", gap: 8,
              ...(tab === t ? TAB_ACTIVE : TAB_INACTIVE),
            }}>
              {t === "react" ? "⚛ React / Next.js (.tsx)" : "🌐 Standalone HTML (.html)"}
              <span style={{
                fontSize: 10, fontWeight: 400,
                color: tab === t ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.25)",
                fontFamily: "'Courier New', monospace",
              }}>
                {fmtKB(t === "react" ? sizes.react : sizes.html)} KB
              </span>
            </button>
          ))}
        </div>

        {/* Description */}
        <div style={{ padding: "10px 20px 0", color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.6, flexShrink: 0 }}>
          {tab === "react"
            ? <><strong style={{ color: "rgba(255,255,255,0.7)" }}>React / Next.js:</strong> Save as <code style={codeStyle}>AsciiBackground.tsx</code>, then <code style={codeStyle}>import {"{ AsciiBackground }"} from "./AsciiBackground"</code>. Already includes <code style={codeStyle}>"use client"</code> for Next.js App Router.</>
            : <><strong style={{ color: "rgba(255,255,255,0.7)" }}>Standalone HTML:</strong> Open directly in a browser or paste the <code style={codeStyle}>&lt;canvas&gt;</code> + <code style={codeStyle}>&lt;script&gt;</code> into any HTML page. Zero dependencies.</>
          }
        </div>

        {/* Code block */}
        <div style={{ flex: 1, overflowY: "auto", margin: "12px 20px", borderRadius: 8, background: "#07070f", border: "1px solid rgba(255,255,255,0.08)", minHeight: 0 }}>
          <pre style={{ margin: 0, padding: "14px 16px", fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.55, color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {code}
          </pre>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 20px 18px", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 10, padding: "8px 12px", borderRadius: 8,
            background: "rgba(74,108,247,0.10)", border: "1px solid rgba(74,108,247,0.22)",
          }}>
            <span style={{ fontSize: 15 }}>⚡</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              Your background: <strong style={{ color: "#fff" }}>{currentKB} KB</strong>
              <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 6px" }}>·</span>
              A typical hero video: <strong style={{ color: "rgba(255,255,255,0.55)" }}>5–10 MB</strong>
              <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 6px" }}>·</span>
              <span style={{ color: "#a78bfa" }}>{Math.round((5 * 1024) / parseFloat(currentKB))}× smaller</span>
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
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
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", borderRadius: 3,
  padding: "1px 5px", fontFamily: "'Courier New', monospace", fontSize: 10,
};
