export class TransformManager {
 constructor(editor){
  this.editor=editor;
  this.init();
 }
 bind(){
  const self=this.editor;
  const getT=()=>{
    const id=self.selectedId||'global';
    if(!self.transforms[id]) self.transforms[id]={...self.defaultTransform};
    return self.transforms[id];
  };
  const upd=()=>{
    const t=getT();
    const setP=(b,v,d)=>{
      const r=document.getElementById('tr-'+b); const n=document.getElementById('tr-'+b+'-num');
      if(r) r.value=v; if(n) n.value=Number(v).toFixed(d);
    };
    setP('x',t.x,1); setP('y',t.y,1); setP('scale',t.scale,2); setP('scaleX',t.scaleX||1,2); setP('scaleY',t.scaleY||1,2); setP('rot',t.rot,1);
  };
  ['x','y','scale','scaleX','scaleY','rot'].forEach(base=>{
    const r=document.getElementById('tr-'+base); const n=document.getElementById('tr-'+base+'-num');
    if(r) r.addEventListener('input',e=>{
      const ids=self.selectedIds.size?Array.from(self.selectedIds):[self.selectedId];
      ids.forEach(id=>{ if(!id) return; if(!self.transforms[id]) self.transforms[id]={...self.defaultTransform}; self.transforms[id][base]=parseFloat(e.target.value); });
      self.applyTransformMulti(); upd();
    });
    if(n) n.addEventListener('input',e=>{
      const ids=self.selectedIds.size?Array.from(self.selectedIds):[self.selectedId];
      const v=parseFloat(e.target.value); if(isNaN(v)) return;
      ids.forEach(id=>{ if(!id) return; if(!self.transforms[id]) self.transforms[id]={...self.defaultTransform}; self.transforms[id][base]=v; });
      self.applyTransformMulti(); upd();
    });
  });
  document.querySelectorAll('.btn-reset').forEach(b=>{
    b.addEventListener('click',()=>{
      const k=b.dataset.reset;
      const ids=self.selectedIds.size?Array.from(self.selectedIds):[self.selectedId];
      ids.forEach(id=>{
        if(!id) return; const t=self.transforms[id]||{...self.defaultTransform};
        if(k==='x') t.x=0; else if(k==='y') t.y=0; else if(k==='scale') t.scale=1; else if(k==='scaleX') t.scaleX=1; else if(k==='scaleY') t.scaleY=1; else if(k==='rot') t.rot=0;
        self.transforms[id]=t;
      });
      self.applyTransformMulti(); upd(); self.pushHistory('Reset '+k);
    });
  });
  self._updateUI=upd;
 }
 applyMulti(){
  const self=self.editor;
  const ids=self.selectedIds.size?Array.from(self.selectedIds):(self.selectedId?[self.selectedId]:[]);
  ids.forEach(id=>{
    if(!self.transforms[id]) self.transforms[id]={...self.defaultTransform};
    const t=self.transforms[id]; const el=self.layerElements[id]||self.textElements[id];
    if(el){
      const sx=(t.scale||1)*(t.scaleX||1); const sy=(t.scale||1)*(t.scaleY||1);
      const baseTransform=el.dataset.baseTransform||'';
      if(el.classList.contains('text-overlay')){
        el.style.transform=baseTransform+` translate(${t.x}px,${t.y}px) scaleX(${sx}) scaleY(${sy}) rotate(${t.rot}deg)`;
      }else{
        el.style.transform=`translate(${t.x}px,${t.y}px) scaleX(${sx}) scaleY(${sy}) rotate(${t.rot}deg)`;
      }
    }
  });
 }
 initDragPreview(){
  const self=this.editor;
  let drag=false,sx,sy,ox,oy,tid=null;
  const getT=id=>{ if(!self.transforms[id]) self.transforms[id]={...self.defaultTransform}; return self.transforms[id]; };
  self.previewBox.addEventListener('mousedown',e=>{
    let textEl=e.target.closest?e.target.closest('.text-overlay'):null;
    if(textEl){ tid=textEl.dataset.clipId||textEl.dataset.textId; self.selectText(tid); drag=true; sx=e.clientX; sy=e.clientY; const t=getT(tid); ox=t.x; oy=t.y; e.preventDefault(); return; }
    let target=e.target.closest?e.target.closest('.layer-item'):null;
    if(target){ tid=target.dataset.clipId; self.selectClip(tid); drag=true; sx=e.clientX; sy=e.clientY; const t2=getT(tid); ox=t2.x; oy=t2.y; e.preventDefault(); return; }
    const vidClip=self.getClipsAtTimeline(self.timelineTime).find(c=>c.type==='video'||c.type==='image');
    if(!vidClip) return; tid=vidClip.id; self.selectClip(tid); drag=true; sx=e.clientX; sy=e.clientY; const t3=getT(tid); ox=t3.x; oy=t3.y; e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!drag||!tid) return; const t=getT(tid); t.x=ox+(e.clientX-sx)/self.previewZoom; t.y=oy+(e.clientY-sy)/self.previewZoom;
    const el=self.layerElements[tid]||self.textElements[tid];
    if(el){
      const sx2=(t.scale||1)*(t.scaleX||1); const sy2=(t.scale||1)*(t.scaleY||1);
      if(el.classList.contains('text-overlay')){
        const base=el.dataset.baseTransform||''; el.style.transform=base+` translate(${t.x}px,${t.y}px) scaleX(${sx2}) scaleY(${sy2}) rotate(${t.rot}deg)`;
      }else el.style.transform=`translate(${t.x}px,${t.y}px) scaleX(${sx2}) scaleY(${sy2}) rotate(${t.rot}deg)`;
    }
  });
  document.addEventListener('mouseup',()=>{ if(drag){ self.pushHistory('Mover preview'); } drag=false; tid=null; });
 }
}
