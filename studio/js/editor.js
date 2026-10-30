import { TransformManager } from './transform.js';
import { TimelineManager } from './timeline.js';
import { ExportManager } from './export.js';

class VideoEditor {
 constructor(){
  this.previewBox=document.getElementById('preview-box'); this.viewport=document.getElementById('preview-viewport');
  this.layersBox=document.getElementById('preview-layers'); this.textLayer=document.getElementById('text-layer');
  this.previewStage=document.getElementById('preview-stage'); this.ruler=document.getElementById('timeline-ruler');
  this.tracksContainer=document.getElementById('timeline-tracks'); this.tracksSidebar=document.getElementById('tracks-sidebar');
  this.tracksList=document.getElementById('tracks-list'); this.playhead=document.getElementById('single-playhead');
  this.cursor=document.getElementById('single-cursor'); this.timeDisplay=document.getElementById('time-display');
  this.zoomLabel=document.getElementById('zoom-label');
  this.projectW=1920; this.projectH=1080; this.aspectRatio='16-9'; this.resolution='1080p';
  this.duration=0; this.clips=[];
  this.videoTracks=[{id:'v1',name:'V1',type:'video',icon:'🎬',num:1,enabled:true},{id:'v2',name:'V2',type:'video',icon:'🎬',num:2,enabled:true},{id:'v3',name:'V3',type:'video',icon:'🎬',num:3,enabled:true}];
  this.audioTracks=[{id:'a1',name:'A1',type:'audio',icon:'🎵',num:1,enabled:true},{id:'a2',name:'A2',type:'audio',icon:'🎵',num:2,enabled:true},{id:'a3',name:'A3',type:'audio',icon:'🎵',num:3,enabled:true}];
  this.selectedId=null; this.selectedTextId=null; this.selectedIds=new Set();
  this.dragState=null; this.pixelsPerSecond=80; this.timelineTime=0; this.isPlaying=false; this.lastTick=0; this.raf=null;
  this.audioElements={}; this.transforms={}; this.textStyles={}; this.defaultTransform={x:0,y:0,scale:1,scaleX:1,scaleY:1,rot:0};
  this.layerElements={}; this.textElements={}; this.history=[]; this.historyIndex=-1; this.clipboard=null; this.isDragging=false;
  this.previewZoom=1; this.fitScale=1; this.dragOverTrackId=null;
  this.transformMgr=new TransformManager(this);
  this.timelineMgr=new TimelineManager(this);
  this.exportMgr=new ExportManager(this);
  this.init();
 }
 get allTracksOrdered(){ const v=[...this.videoTracks].sort((a,b)=>b.num-a.num); const a=[...this.audioTracks].sort((a,b)=>a.num-b.num); return [...v,...a]; }
 get allTracks(){ return [...this.videoTracks,...this.audioTracks]; }
 cloneClips(){ return this.clips.map(c=>({id:c.id,name:c.name,type:c.type,url:c.url,start:c.start,duration:c.duration,srcStart:c.srcStart,srcDuration:c.srcDuration,trackId:c.trackId,linkId:c.linkId,linkedTo:c.linkedTo,origW:c.origW,origH:c.origH,text:c.text})); }
 pushHistory(act){ const snap={clips:this.cloneClips(),transforms:JSON.parse(JSON.stringify(this.transforms)),textStyles:JSON.parse(JSON.stringify(this.textStyles)),selectedId:this.selectedId,selectedIds:Array.from(this.selectedIds),action:act}; this.history=this.history.slice(0,this.historyIndex+1); this.history.push(snap); this.historyIndex=this.history.length-1; if(this.history.length>80){ this.history.shift(); this.historyIndex--; } const el=document.getElementById('undo-status'); if(el) el.textContent=act+' • Multi:'+this.selectedIds.size+' • v21 PRO'; }
 undo(){ if(this.historyIndex<=0) return; this.historyIndex--; this.restoreHistory(); }
 redo(){ if(this.historyIndex>=this.history.length-1) return; this.historyIndex++; this.restoreHistory(); }
 restoreHistory(){
  const h=this.history[this.historyIndex]; if(!h) return;
  this.transforms=JSON.parse(JSON.stringify(h.transforms)); this.textStyles=JSON.parse(JSON.stringify(h.textStyles||{}));
  const curMap=new Map(this.clips.map(c=>[c.id,c])); const newClips=[];
  h.clips.forEach(saved=>{ const ex=curMap.get(saved.id); const url=ex?ex.url:saved.url; newClips.push({...saved,url}); });
  const newIds=new Set(newClips.map(c=>c.id));
  Object.keys(this.audioElements).forEach(id=>{ if(!newIds.has(parseFloat(id))&&!newIds.has(id)){ const a=this.audioElements[id]; if(a){ a.pause(); try{a.src='';}catch(e){} } delete this.audioElements[id]; } });
  Object.keys(this.layerElements).forEach(id=>{ if(!newIds.has(parseFloat(id))&&!newIds.has(id)){ const el=this.layerElements[id]; if(el){ if(el.tagName==='VIDEO') el.pause(); el.remove(); } delete this.layerElements[id]; } });
  Object.keys(this.textElements).forEach(id=>{ if(!newIds.has(parseFloat(id))&&!newIds.has(id)){ const el=this.textElements[id]; if(el) el.remove(); delete this.textElements[id]; } });
  this.clips=newClips; this.selectedId=h.selectedId&&newIds.has(h.selectedId)?h.selectedId:(newClips[0]?newClips[0].id:null); this.selectedIds=new Set((h.selectedIds||[]).filter(id=>newIds.has(id)));
  this.duration=Math.max(...this.clips.map(c=>c.start+c.duration),0); this.updateMetrics(); this.renderAll(); this.syncToTimeline(); if(this._updateUI) this._updateUI();
  newClips.forEach(c=>{ if(c.type==='audio'&&!this.audioElements[c.id]) this.audioElements[c.id]=new Audio(c.url); });
 }
 setPreviewZoom(f){ this.previewZoom=Math.max(0.1,Math.min(3,f)); const s=document.getElementById('preview-zoom-slider'); if(s) s.value=Math.round(this.previewZoom*100); const l=document.getElementById('preview-zoom-label'); if(l) l.textContent=Math.round(this.previewZoom*100)+'%'; this.updatePreviewBoxSize(); }
 updatePreviewBoxSize(){
  const box=this.previewBox; if(!box||!this.previewStage) return;
  const stageW=this.viewport.clientWidth*0.92; const stageH=this.viewport.clientHeight*0.92;
  this.fitScale=Math.min(stageW/this.projectW, stageH/this.projectH, 1);
  const baseW=this.projectW*this.fitScale; const baseH=this.projectH*this.fitScale;
  box.style.width=baseW+'px'; box.style.height=baseH+'px'; box.style.transform='scale('+this.previewZoom+')';
 }
 setAspect(r){ this.aspectRatio=r; const base=this.resolution==='480p'?480:this.resolution==='720p'?720:1080; if(r==='9-16'){ this.projectH=Math.round(base*16/9); this.projectW=Math.round(this.projectH*9/16); } else if(r==='1-1'){ this.projectW=base; this.projectH=base; } else if(r==='4-5'){ this.projectH=Math.round(base*5/4); this.projectW=Math.round(this.projectH*4/5); } else { this.projectW=Math.round(base*16/9); this.projectH=base; } document.getElementById('proj-w').value=this.projectW; document.getElementById('proj-h').value=this.projectH; this.updatePreviewBoxSize(); const od=document.getElementById('opt-original-desc'); if(od) od.textContent=this.projectW+'x'+this.projectH+' (W/H exacto)'; }
 setResolution(res){ this.resolution=res; this.setAspect(this.aspectRatio); }
 applyCustomSize(){ const w=parseInt(document.getElementById('proj-w').value)||1920; const h=parseInt(document.getElementById('proj-h').value)||1080; this.projectW=w; this.projectH=h; this.updatePreviewBoxSize(); const od=document.getElementById('opt-original-desc'); if(od) od.textContent=w+'x'+h+' (W/H exacto)'; }
 applyTransformMulti(){ this.transformMgr.applyMulti(); }
 showContextMenu(x,y){ const menu=document.getElementById('context-menu'); if(!menu) return; menu.style.left=x+'px'; menu.style.top=y+'px'; menu.style.display='block'; setTimeout(()=>{ const rect=menu.getBoundingClientRect(); if(rect.right>window.innerWidth) menu.style.left=(x-rect.width)+'px'; if(rect.bottom>window.innerHeight) menu.style.top=(y-rect.height)+'px'; },10); }
 getSelectedImportTrack(){ const sel1=document.getElementById('import-track-select'); const sel2=document.getElementById('import-track-select2'); const v=sel1?sel1.value:(sel2?sel2.value:'auto'); return v; }
 resolveImportTrackForType(type, requestedTrackId){
  const req=requestedTrackId||this.getSelectedImportTrack();
  if(req==='auto') return null;
  if(req==='newV'){ const n=this.videoTracks.length+1; const nt={id:'v'+Date.now()+n,name:'V'+n,type:'video',icon:'🎬',num:n,enabled:true}; this.videoTracks.push(nt); this.renderTracks(); return nt.id; }
  if(req==='newA'){ const n=this.audioTracks.length+1; const nt={id:'a'+Date.now()+n,name:'A'+n,type:'audio',icon:'🎵',num:n,enabled:true}; this.audioTracks.push(nt); this.renderTracks(); return nt.id; }
  const all=this.allTracks; const found=all.find(t=>t.id===req);
  if(found){
    if(type==='audio'&&found.type!=='audio') return null;
    if((type==='video'||type==='image'||type==='text')&&found.type==='audio') return null;
    return found.id;
  }
  return null;
 }
 findFreeTrack(type, afterTime){
  const after=afterTime||0;
  if(type==='audio'){
    for(let i=0;i<this.audioTracks.length;i++){ const tid=this.audioTracks[i].id; const overlap=this.clips.some(c=>c.trackId===tid && !(c.start+c.duration <= after || c.start >= after+0.1)); if(!overlap) return tid; }
    const n=this.audioTracks.length+1; const nt={id:'a'+Date.now()+n,name:'A'+n,type:'audio',icon:'🎵',num:n,enabled:true}; this.audioTracks.push(nt); this.renderTracks(); return nt.id;
  }else{
    for(let i=0;i<this.videoTracks.length;i++){ const tid=this.videoTracks[i].id; const overlap=this.clips.some(c=>c.trackId===tid && c.type!=='audio' && !(c.start+c.duration <= after || c.start >= after+0.1)); if(!overlap) return tid; }
    return this.videoTracks[0]?this.videoTracks[0].id:'v1';
  }
 }
 handleFiles(fileList, forcedTrackId){
  const files=Array.from(fileList); if(!files.length) return;
  const requestedTrack=forcedTrackId||this.getSelectedImportTrack();
  let lastEnd=this.clips.length?Math.max(...this.clips.map(c=>c.start+c.duration)):0;
  let offset=lastEnd>0?lastEnd+0.3:0;
  const useSpecific=requestedTrack&&requestedTrack!=='auto';
  if(useSpecific) offset=this.timelineTime;
  files.forEach(file=>{
    const url=URL.createObjectURL(file);
    const type=file.type.startsWith('image/')?'image':file.type.startsWith('audio/')?'audio':'video';
    const id=Date.now()+Math.random();
    let trackId;
    if(useSpecific){ const resolved=this.resolveImportTrackForType(type, requestedTrack); trackId=resolved?resolved:this.findFreeTrack(type, offset); }
    else trackId=this.findFreeTrack(type, offset);
    const clip={id,name:file.name,type,url,start:offset,duration:type==='image'?5:0,srcStart:0,srcDuration:type==='image'?5:0,trackId,origW:0,origH:0,linkId:null,linkedTo:null};
    if(type==='video'){
      const v=document.createElement('video'); v.src=url; v.muted=true; v.playsInline=true;
      v.addEventListener('loadedmetadata',()=>{ clip.duration=v.duration; clip.srcDuration=v.duration; clip.origW=v.videoWidth; clip.origH=v.videoHeight; this.duration=Math.max(this.duration,clip.start+clip.duration); this.updateMetrics(); this.renderAll(); this.selectClip(clip.id); this.syncToTimeline(); if(!this.clips.find(c=>(c.linkedTo===clip.id||c.linkId===clip.id)&&c.type==='audio')) this.createLinkedAudio(clip,url); }, {once:true});
    }else if(type==='image'){ const img=new Image(); img.src=url; img.onload=()=>{ clip.origW=img.naturalWidth; clip.origH=img.naturalHeight; this.renderAll(); this.selectClip(clip.id); this.syncToTimeline(); }; }
    else if(type==='audio'){ const a=document.createElement('audio'); a.src=url; a.addEventListener('loadedmetadata',()=>{ clip.duration=a.duration; clip.srcDuration=a.duration; this.duration=Math.max(this.duration,clip.start+clip.duration); this.updateMetrics(); this.renderAll(); }, {once:true}); this.audioElements[id]=new Audio(url); }
    this.clips.push(clip); this.transforms[id]={...this.defaultTransform};
    if(useSpecific) offset+=0.05; else offset+=(clip.duration||5)+0.3;
  });
  const ph=document.getElementById('placeholder'); if(ph) ph.style.display='none';
  this.duration=Math.max(...this.clips.map(c=>c.start+c.duration),0);
  this.updateMetrics(); this.renderAll(); this.pushHistory('Agregar a '+(requestedTrack||'auto')); if(this.clips.length) this.selectClip(this.clips[this.clips.length-1].id);
  this.updateImportSelectors();
 }
 createLinkedAudio(videoClip,url){
  if(this.clips.find(c=>c.linkedTo===videoClip.id&&c.type==='audio')) return;
  let audioTrackId=null;
  for(let i=0;i<this.audioTracks.length;i++){ const tid=this.audioTracks[i].id; const conflict=this.clips.some(c=>c.trackId===tid&&c.type==='audio'&&Math.abs(c.start-videoClip.start)<0.05); if(!conflict){ audioTrackId=tid; break; } }
  if(!audioTrackId){ const n=this.audioTracks.length+1; const nt={id:'a'+Date.now()+n,name:'A'+n,type:'audio',icon:'🎵',num:n,enabled:true}; this.audioTracks.push(nt); audioTrackId=nt.id; }
  const audioId=Date.now()+Math.random()+1;
  const ac={id:audioId,name:'🔗 '+videoClip.name+' (audio)',type:'audio',url,start:videoClip.start,duration:videoClip.duration,srcStart:videoClip.srcStart,srcDuration:videoClip.srcDuration,trackId:audioTrackId,origW:0,origH:0,linkId:videoClip.id,linkedTo:videoClip.id};
  videoClip.linkId=audioId; videoClip.linkedTo=audioId; this.clips.push(ac);
  if(!this.audioElements[audioId]) this.audioElements[audioId]=new Audio(url);
  this.duration=Math.max(this.duration,ac.start+ac.duration); this.updateMetrics(); this.renderAll(); this.updateImportSelectors();
 }
 updateImportSelectors(){
  const selects=[document.getElementById('import-track-select'), document.getElementById('import-track-select2')];
  selects.forEach(sel=>{
    if(!sel) return; const cur=sel.value; sel.innerHTML='<option value="auto">AUTO (libre)</option>';
    this.videoTracks.slice().sort((a,b)=>a.num-b.num).forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name+' 🎬'; sel.appendChild(o); });
    this.audioTracks.slice().sort((a,b)=>a.num-b.num).forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name+' 🎵'; sel.appendChild(o); });
    const oNewV=document.createElement('option'); oNewV.value='newV'; oNewV.textContent='+ Nueva V'; sel.appendChild(oNewV);
    const oNewA=document.createElement('option'); oNewA.value='newA'; oNewA.textContent='+ Nueva A'; sel.appendChild(oNewA);
    if(Array.from(sel.options).some(o=>o.value===cur)) sel.value=cur; else sel.value='auto';
  });
 }
 setZoom(pps){ this.pixelsPerSecond=Math.max(1,Math.min(1000,pps)); const s=document.getElementById('zoom-slider'); if(s) s.value=this.pixelsPerSecond; if(this.zoomLabel) this.zoomLabel.textContent=Math.round(this.pixelsPerSecond)+' px/s'; this.updateMetrics(); this.renderAll(); this.updatePlayheadPos(); }
 zoomIn(){ this.setZoom(this.pixelsPerSecond*1.4); } zoomOut(){ this.setZoom(this.pixelsPerSecond/1.4); }
 zoomFit(){ const maxEnd=Math.max(...this.clips.map(c=>c.start+c.duration),60); const containerW=this.tracksContainer.clientWidth-100; const ideal=containerW/maxEnd; this.setZoom(Math.max(1,Math.min(1000,ideal))); }
 zoomDetail(){ this.setZoom(200); }
 updateMetrics(){ const maxEnd=Math.max(...this.clips.map(c=>c.start+c.duration),this.duration||0,60); const w=Math.max(800,maxEnd*this.pixelsPerSecond+400); document.querySelectorAll('.track-content').forEach(el=>el.style.minWidth=w+'px'); if(this.ruler) this.ruler.style.minWidth=w+'px'; }
 renderTracks(){
  if(!this.tracksSidebar||!this.tracksList) return;
  this.tracksSidebar.innerHTML='<div class="ruler-spacer">PISTAS 👁️/🚫</div>'; this.tracksList.innerHTML='';
  this.allTracksOrdered.forEach(track=>{
    const lbl=document.createElement('div'); lbl.className='track-label-item '+(track.type==='audio'?'a-track':'v-track')+(track.enabled===false?' disabled':'');
    if(this.dragOverTrackId===track.id) lbl.classList.add('drag-over'); lbl.dataset.trackId=track.id;
    lbl.innerHTML=`<button class="track-toggle ${track.enabled===false?'off':''}" data-track="${track.id}">${track.enabled===false?'🚫':'👁️'}</button><span class="num">${track.name}</span><span style="margin-left:auto;font-size:7px;color:#666">soltar aquí</span>`;
    const toggle=lbl.querySelector('.track-toggle');
    toggle.addEventListener('click',e=>{ e.stopPropagation(); track.enabled=track.enabled===false?true:false; this.renderTracks(); this.syncToTimeline(); });
    lbl.addEventListener('dragover',e=>{ e.preventDefault(); this.dragOverTrackId=track.id; this.clearDragOver(); lbl.classList.add('drag-over'); });
    lbl.addEventListener('dragleave',()=>{ lbl.classList.remove('drag-over'); });
    lbl.addEventListener('drop',e=>{ e.preventDefault(); lbl.classList.remove('drag-over'); if(e.dataTransfer.files.length) this.handleFiles(e.dataTransfer.files, track.id); });
    this.tracksSidebar.appendChild(lbl);
    const row=document.createElement('div'); row.className='track'+(track.enabled===false?' disabled':''); if(this.dragOverTrackId===track.id) row.classList.add('drag-over'); row.dataset.trackId=track.id;
    row.innerHTML=`<div class="track-content" data-track-id="${track.id}" id="content-${track.id}"></div>`;
    row.addEventListener('dragover',e=>{ e.preventDefault(); this.dragOverTrackId=track.id; this.clearDragOver(); row.classList.add('drag-over'); lbl.classList.add('drag-over'); });
    row.addEventListener('dragleave',e=>{ if(!row.contains(e.relatedTarget)) row.classList.remove('drag-over'); });
    row.addEventListener('drop',e=>{ e.preventDefault(); row.classList.remove('drag-over'); this.dragOverTrackId=null; if(e.dataTransfer.files.length) this.handleFiles(e.dataTransfer.files, track.id); });
    this.tracksList.appendChild(row);
  });
  const addRow=document.createElement('div'); addRow.style.display='flex'; addRow.style.gap='3px'; addRow.style.padding='4px'; addRow.innerHTML='<button class="add-track-btn" id="add-v-inner">+ V</button><button class="add-track-btn" id="add-a-inner">+ A</button>'; this.tracksSidebar.appendChild(addRow);
  document.getElementById('add-v-inner').addEventListener('click',()=>this.addTrack('video')); document.getElementById('add-a-inner').addEventListener('click',()=>this.addTrack('audio'));
  setTimeout(()=>{this.renderClips(); this.updateImportSelectors();},30);
 }
 clearDragOver(){ document.querySelectorAll('.track.drag-over, .track-label-item.drag-over').forEach(el=>el.classList.remove('drag-over')); }
 renderRuler(){ if(!this.ruler) return; this.ruler.querySelectorAll('.ruler-mark').forEach(e=>e.remove()); const maxEnd=Math.max(...this.clips.map(c=>c.start+c.duration),this.duration||0,60); const step=this.pixelsPerSecond>200?1:this.pixelsPerSecond>100?2:this.pixelsPerSecond>40?5:this.pixelsPerSecond>15?10:30; for(let t=0;t<=maxEnd+step;t+=step){ const el=document.createElement('div'); el.className='ruler-mark'; el.style.left=(t*this.pixelsPerSecond)+'px'; el.textContent=this.format(t); this.ruler.appendChild(el); } }
 renderClips(){
  this.allTracksOrdered.forEach(track=>{
    const content=document.getElementById('content-'+track.id); if(!content) return;
    content.querySelectorAll('.clip').forEach(e=>e.remove());
    this.clips.filter(c=>c.trackId===track.id).sort((a,b)=>a.start-b.start).forEach(clip=>{
      const div=document.createElement('div'); div.className='clip '+clip.type+(clip.linkId||clip.linkedTo?' linked':''); div.dataset.id=clip.id;
      if(clip.id===this.selectedId) div.classList.add('selected'); if(this.selectedIds.has(clip.id)) div.classList.add('multiselected');
      if(clip.linkedTo&&this.selectedIds.has(clip.linkedTo)) div.classList.add('multiselected'); if(clip.linkId&&this.selectedIds.has(clip.linkId)) div.classList.add('multiselected');
      if(clip.id===this.selectedTextId) div.classList.add('selected'); if(this.dragState&&this.dragState.movingIds&&this.dragState.movingIds.indexOf(clip.id)!==-1) div.classList.add('dragging');
      div.style.left=(clip.start*this.pixelsPerSecond)+'px'; div.style.width=Math.max(22,clip.duration*this.pixelsPerSecond)+'px';
      const linkIcon=clip.linkId||clip.linkedTo?'🔗 ':''; const label=clip.type==='text'?(clip.text||'Texto'):clip.name;
      div.innerHTML=`<div class="clip-handle left"></div><span style="pointer-events:none;overflow:hidden;text-overflow:ellipsis">${linkIcon}${label.slice(0,14)} ${this.format(clip.duration)}</span><div class="clip-handle right"></div>`;
      div.addEventListener('mousedown',e=>this.onClipMouseDown(e,clip));
      div.addEventListener('click',e=>{
        e.stopPropagation();
        if(e.ctrlKey||e.metaKey){
          if(this.selectedIds.has(clip.id)){ this.selectedIds.delete(clip.id); if(clip.linkId) this.selectedIds.delete(clip.linkId); if(clip.linkedTo) this.selectedIds.delete(clip.linkedTo); }
          else{ this.selectedIds.add(clip.id); if(clip.linkId) this.selectedIds.add(clip.linkId); if(clip.linkedTo) this.selectedIds.add(clip.linkedTo); }
          this.renderClips(); this.updateSelectionInfo();
        }else{
          if(clip.type==='text') this.selectText(clip.id); else this.selectClip(clip.id);
        }
      });
      div.addEventListener('contextmenu',e=>{ e.preventDefault(); e.stopPropagation(); if(!this.selectedIds.has(clip.id)){ if(clip.type==='text') this.selectText(clip.id); else this.selectClip(clip.id); } this.showContextMenu(e.clientX,e.clientY); });
      content.appendChild(div);
    });
  });
  this.updatePlayheadPos();
 }
 updateSelectionInfo(){
  const inf=document.getElementById('selected-info'); if(!inf) return;
  if(this.selectedIds.size>1) inf.textContent=`Multi-select: ${this.selectedIds.size} clips - Magnet ${this.timelineMgr?.snapEnabled?'ON':'OFF'} - Arrastra vertical para cambiar línea. Selección por rectángulo en área vacía.`;
  else if(this.selectedId){ const c=this.clips.find(x=>x.id==this.selectedId); if(c) inf.textContent=`${c.type.toUpperCase()} | ${c.text||c.name} | ${c.trackId.toUpperCase()} | Magnet ${this.timelineMgr?.snapEnabled?'ON':'OFF'} | Playhead solo en regla`; }
  else inf.textContent='Arrastra clip arriba/abajo para cambiar línea. Arrastra en área vacía para selección por rango. Magnet se acerca a cortes.';
 }
 getLinkedClip(clip){ if(!clip) return null; if(clip.linkId) return this.clips.find(c=>c.id===clip.linkId); if(clip.linkedTo) return this.clips.find(c=>c.id===clip.linkedTo); return null; }
 copySelected(){ const ids=this.selectedIds.size?Array.from(this.selectedIds):(this.selectedId?[this.selectedId]:[]); if(!ids.length) return; const clips=ids.map(id=>this.clips.find(c=>c.id==id)).filter(Boolean); this.clipboard=clips.map(c=>JSON.parse(JSON.stringify({...c,linkId:null,linkedTo:null}))); }
 cutSelected(){ if(!this.selectedIds.size&&!this.selectedId) return; this.copySelected(); this.deleteSelected(); }
 pasteAtPlayhead(){
  if(!this.clipboard||!this.clipboard.length){ alert('Nada en portapapeles'); return; }
  const baseTime=this.timelineTime; let targetTrack=this.getSelectedImportTrack(); let targetId=null; if(targetTrack&&targetTrack!=='auto'&&targetTrack!=='newV'&&targetTrack!=='newA') targetId=targetTrack;
  this.clipboard.forEach((base,idx)=>{
    const newId=Date.now()+Math.random()+idx;
    const nc={...base,id:newId,start:baseTime+idx*0.2+(base.start-(this.clipboard[0].start||0)),url:base.url,linkId:null,linkedTo:null};
    if(targetId) nc.trackId=targetId;
    this.clips.push(nc); this.transforms[newId]={...(this.transforms[base.id]||this.defaultTransform)};
    if(nc.type==='text'&&base.text) this.textStyles[newId]={...(this.textStyles[base.id]||{}),id:newId,text:base.text};
    if(nc.type==='audio') this.audioElements[newId]=new Audio(nc.url);
  });
  this.selectedIds.clear(); this.selectedId=this.clips[this.clips.length-1].id; this.renderAll(); this.syncToTimeline(); this.pushHistory('Pegar multi');
 }
 duplicateSelected(){
  const ids=this.selectedIds.size?Array.from(this.selectedIds):(this.selectedId?[this.selectedId]:[]); if(!ids.length) return;
  ids.forEach((id,idx)=>{
    const base=this.clips.find(c=>c.id==id); if(!base) return;
    const newId=Date.now()+Math.random()+idx+100;
    const nc={...base,id:newId,start:base.start+base.duration+0.3,url:base.url,linkId:null,linkedTo:null};
    this.clips.push(nc); this.transforms[newId]={...(this.transforms[base.id]||this.defaultTransform)};
    if(nc.type==='text') this.textStyles[newId]={...(this.textStyles[base.id]||{}),id:newId};
    if(nc.type==='audio') this.audioElements[newId]=new Audio(nc.url);
  });
  this.renderAll(); this.pushHistory('Duplicar multi');
 }
 getTrackAtY(y){
  const tracks=document.querySelectorAll('.track');
  for(let i=0;i<tracks.length;i++){ const rect=tracks[i].getBoundingClientRect(); if(y>=rect.top&&y<=rect.bottom) return tracks[i].dataset.trackId; }
  const labels=document.querySelectorAll('.track-label-item');
  for(let j=0;j<labels.length;j++){ const r=labels[j].getBoundingClientRect(); if(y>=r.top&&y<=r.bottom) return labels[j].dataset.trackId; }
  return null;
 }
 canMoveToTrack(clip, targetTrackId){
  if(!targetTrackId) return false; const target=this.allTracks.find(t=>t.id===targetTrackId); if(!target) return false;
  if(clip.type==='audio') return target.type==='audio'; else return target.type==='video';
 }
 onClipMouseDown(e,clip){
  const h=e.target.closest?e.target.closest('.clip-handle'):null;
  if(h){
    const linked=this.getLinkedClip(clip); const left=h.classList.contains('left');
    this.dragState={type:'resize',clipId:clip.id,isLeft:left,startX:e.clientX,origStart:clip.start,origDur:clip.duration,origSrcStart:clip.srcStart,linkedId:linked?linked.id:null,linkedOrigStart:linked?linked.start:0,linkedOrigDur:linked?linked.duration:0,linkedOrigSrcStart:linked?linked.srcStart:0};
  }else{
    let movingIds=this.selectedIds.has(clip.id)?Array.from(this.selectedIds):[clip.id];
    const fullMoving=new Set(movingIds);
    movingIds.forEach(id=>{ const c=this.clips.find(x=>x.id==id); if(!c) return; if(c.linkId) fullMoving.add(c.linkId); if(c.linkedTo) fullMoving.add(c.linkedTo); });
    movingIds=Array.from(fullMoving);
    this.dragState={type:'drag',clipId:clip.id,startX:e.clientX,startY:e.clientY,origStart:clip.start,origTrackId:clip.trackId,movingIds,origStarts:{},origTracks:{},hasMovedY:false};
    movingIds.forEach(id=>{ const c=this.clips.find(x=>x.id==id); if(c){ this.dragState.origStarts[id]=c.start; this.dragState.origTracks[id]=c.trackId; } });
    if(!this.selectedIds.has(clip.id)&&!(e.ctrlKey||e.metaKey)){ if(clip.type==='text') this.selectText(clip.id); else this.selectClip(clip.id); }
  }
  this.isDragging=true; e.preventDefault(); e.stopPropagation();
 }
 onMouseMove(e){
  if(!this.dragState) return;
  if(this.dragState.type==='playhead'){ this.seekTimelineFromEvent(e); return; }
  const clip=this.clips.find(c=>c.id===this.dragState.clipId); if(!clip) return;
  const linked=this.dragState.linkedId?this.clips.find(c=>c.id===this.dragState.linkedId):null;
  const dx=e.clientX-this.dragState.startX; let ds=dx/this.pixelsPerSecond;
  if(this.dragState.type==='drag'){
    if(this.dragState.movingIds&&this.dragState.movingIds.length>1){
      // Calculate snapped time for primary clip
      const primaryOrig=this.dragState.origStarts[this.dragState.clipId]||this.dragState.origStart;
      let newStart=Math.max(0,primaryOrig+ds);
      newStart=this.timelineMgr?this.timelineMgr.applySnap(newStart, this.dragState.movingIds):newStart;
      const delta=newStart-primaryOrig;
      this.dragState.movingIds.forEach(id=>{
        const c=this.clips.find(x=>x.id==id); if(!c) return;
        const orig=this.dragState.origStarts[id]; if(orig===undefined) return;
        c.start=Math.max(0,orig+delta);
      });
    }else{
      let newStart=Math.max(0,this.dragState.origStart+ds);
      newStart=this.timelineMgr?this.timelineMgr.applySnap(newStart, [clip.id]):newStart;
      clip.start=newStart;
      if(linked&&this.dragState.movingIds&&this.dragState.movingIds.indexOf(linked.id)!==-1){}
      else if(linked) linked.start=Math.max(0,this.dragState.linkedOrigStart+ (newStart-this.dragState.origStart));
    }
    const dy=Math.abs(e.clientY-this.dragState.startY);
    if(dy>12) this.dragState.hasMovedY=true;
    if(this.dragState.hasMovedY){
      const targetTrackId=this.getTrackAtY(e.clientY);
      if(targetTrackId&&targetTrackId!==clip.trackId&&this.canMoveToTrack(clip,targetTrackId)){
        if(this.dragState.movingIds.length>1){
          const targetTrack=this.allTracks.find(t=>t.id===targetTrackId);
          this.dragState.movingIds.forEach(id=>{
            const c=this.clips.find(x=>x.id==id); if(!c) return;
            if(c.type==='audio'&&targetTrack.type==='audio') c.trackId=targetTrackId;
            else if(c.type!=='audio'&&targetTrack.type!=='audio') c.trackId=targetTrackId;
          });
        }else clip.trackId=targetTrackId;
        this.dragOverTrackId=targetTrackId;
        document.querySelectorAll('.track').forEach(tr=>{ tr.classList.toggle('drag-over', tr.dataset.trackId===targetTrackId); });
        document.querySelectorAll('.track-label-item').forEach(lb=>{ lb.classList.toggle('drag-over', lb.dataset.trackId===targetTrackId); });
      }
    }
    this.renderClips();
  }else{
    if(this.dragState.isLeft){
      let ns=Math.max(0,this.dragState.origStart+ds); ns=this.timelineMgr?this.timelineMgr.applySnap(ns, [clip.id]):ns;
      let nd=this.dragState.origDur-(ns-this.dragState.origStart);
      if(nd<0.2){ nd=0.2; ns=this.dragState.origStart+this.dragState.origDur-nd; }
      const d=ns-this.dragState.origStart; clip.start=ns; clip.duration=nd; if(clip.type!=='image'&&clip.type!=='text') clip.srcStart=this.dragState.origSrcStart+d;
      if(linked){ linked.start=ns; linked.duration=nd; if(linked.type!=='image') linked.srcStart=this.dragState.linkedOrigSrcStart+d; }
    }else{ clip.duration=Math.max(0.2,this.dragState.origDur+ds); if(linked) linked.duration=Math.max(0.2,this.dragState.linkedOrigDur+ds); }
    this.renderClips(); this.updatePlayheadPos();
  }
 }
 onMouseUp(){
  if(this.isDragging&&this.dragState&&(this.dragState.type==='drag'||this.dragState.type==='resize')){
    this.duration=Math.max(...this.clips.map(c=>c.start+c.duration),0); this.updateMetrics(); this.renderAll(); this.syncToTimeline(); this.pushHistory(this.dragState.type==='drag'?'Mover':'Redim'); this.clearDragOver(); this.dragOverTrackId=null; if(this.timelineMgr) this.timelineMgr.hideSnapIndicator();
  }
  this.dragState=null; this.isDragging=false; this.clearDragOver(); this.dragOverTrackId=null;
 }
 selectClip(id){
  this.selectedId=id; this.selectedTextId=null;
  if(!event||(!event.ctrlKey&&!event.metaKey)) this.selectedIds.clear();
  this.selectedIds.add(id);
  const clip=this.clips.find(c=>c.id==id); if(clip&&clip.linkId) this.selectedIds.add(clip.linkId); if(clip&&clip.linkedTo) this.selectedIds.add(clip.linkedTo);
  document.querySelectorAll('.clip').forEach(el=>{ const cid=el.dataset.id; el.classList.toggle('selected',cid==id); el.classList.toggle('multiselected',this.selectedIds.has(cid)&&cid!=id); });
  const c=this.clips.find(x=>x.id==id); if(c){ const inf=document.getElementById('selected-info'); if(inf) inf.textContent=`${c.type.toUpperCase()} | ${c.text||c.name} | ${c.trackId.toUpperCase()} | ${this.format(c.start)}→${this.format(c.start+c.duration)} | Multi:${this.selectedIds.size} | Magnet ${this.timelineMgr?.snapEnabled?'ON':'OFF'}`; if(!this.transforms[id]) this.transforms[id]={...this.defaultTransform}; if(this._updateUI) this._updateUI(); document.getElementById('text-edit-group').style.display=c.type==='text'?'block':'none'; if(c.type==='text'&&this._syncTextUI) this._syncTextUI(); }
  document.querySelectorAll('.text-overlay').forEach(el=>el.classList.remove('selected')); this.updateSelectionInfo();
 }
 selectText(id){
  this.selectedTextId=id; this.selectedId=id;
  if(!event||(!event.ctrlKey&&!event.metaKey)) this.selectedIds.clear();
  this.selectedIds.add(id);
  document.querySelectorAll('.clip').forEach(el=>{ el.classList.toggle('selected',el.dataset.id==id); el.classList.toggle('multiselected',this.selectedIds.has(el.dataset.id)&&el.dataset.id!=id); });
  const clip=this.clips.find(c=>c.id==id);
  let st=this.textStyles[id]; if(!st&&clip){ st={id,text:clip.text||'Texto',font:'Inter, system-ui, sans-serif',size:32,color:'#ffffff',bg:'#000000',bgAlpha:0.35,weight:'700',align:'center'}; this.textStyles[id]=st; }
  if(st){ document.getElementById('text-edit-group').style.display='block'; if(this._syncTextUI) this._syncTextUI(); }
  const el=this.textElements[id]; if(el){ document.querySelectorAll('.text-overlay').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); }
  if(this._updateUI) this._updateUI();
  const inf=document.getElementById('selected-info'); if(inf&&clip) inf.textContent=`TEXTO en V | ${clip.text} | ${this.format(clip.start)}→${this.format(clip.start+clip.duration)} | Multi:${this.selectedIds.size}`;
  this.updateSelectionInfo();
 }
 clearSelection(){ this.selectedIds.clear(); this.selectedId=null; this.selectedTextId=null; document.querySelectorAll('.clip').forEach(el=>{el.classList.remove('selected'); el.classList.remove('multiselected');}); document.querySelectorAll('.text-overlay').forEach(el=>el.classList.remove('selected')); document.getElementById('text-edit-group').style.display='none'; this.updateSelectionInfo(); }
 deleteSelected(){
  const ids=this.selectedIds.size?Array.from(this.selectedIds):(this.selectedId?[this.selectedId]:[]); if(!ids.length) return; this.pushHistory('Borrar '+ids.length);
  const fullSet=new Set(ids); ids.forEach(id=>{ const c=this.clips.find(x=>x.id==id); if(c){ if(c.linkId) fullSet.add(c.linkId); if(c.linkedTo) fullSet.add(c.linkedTo); } });
  const finalIds=Array.from(fullSet);
  finalIds.forEach(id=>{ const el=this.layerElements[id]; if(el){ if(el.tagName==='VIDEO'){ el.pause(); try{el.src='';}catch(e){} } el.remove(); delete this.layerElements[id]; } const a=this.audioElements[id]; if(a){ a.pause(); try{a.src='';}catch(e){} delete this.audioElements[id]; } const t=this.textElements[id]; if(t){ t.remove(); delete this.textElements[id]; } });
  this.clips=this.clips.filter(c=>finalIds.indexOf(c.id)===-1); finalIds.forEach(id=>{delete this.transforms[id]; delete this.textStyles[id];});
  this.selectedIds.clear(); this.selectedId=this.clips[0]?this.clips[0].id:null; this.selectedTextId=null; this.renderAll(); this.syncToTimeline(); this.updateSelectionInfo();
  if(!this.clips.length){ const ph=document.getElementById('placeholder'); if(ph) ph.style.display='block'; this.layersBox.innerHTML=''; this.layerElements={}; this.textElements={}; this.duration=0; this.timelineTime=0; this.updatePlayheadPos(); document.getElementById('text-edit-group').style.display='none'; }
 }
 splitAtPlayhead(){
  const t=this.timelineTime;
  const targets=this.selectedIds.size?Array.from(this.selectedIds).map(id=>this.clips.find(c=>c.id==id)).filter(Boolean):this.clips.filter(c=>t>c.start+0.08&&t<c.start+c.duration-0.08);
  if(!targets.length){ alert('Selecciona clips con Ctrl+Click o pon playhead sobre clip'); return; }
  this.pushHistory('Dividir '+targets.length); const newIds=[];
  targets.forEach(cl=>{
    if(!(t>cl.start+0.08&&t<cl.start+cl.duration-0.08)) return;
    const off=t-cl.start; const linked=this.getLinkedClip(cl); const orig=cl.duration; cl.duration=off;
    const newId=Date.now()+Math.random()+newIds.length; const nc={id:newId,name:cl.name,type:cl.type,url:cl.url,start:t,duration:orig-off,srcStart:cl.type==='image'||cl.type==='text'?0:cl.srcStart+off,srcDuration:cl.srcDuration,trackId:cl.trackId,origW:cl.origW,origH:cl.origH,linkId:null,linkedTo:null,text:cl.text};
    this.transforms[newId]={...(this.transforms[cl.id]||this.defaultTransform)}; if(cl.type==='text') this.textStyles[newId]={...(this.textStyles[cl.id]||{}),id:newId};
    if(nc.type==='audio') this.audioElements[newId]=new Audio(nc.url);
    if(linked){ const nLid=Date.now()+Math.random()+newIds.length+100; const nL={id:nLid,name:linked.name,type:'audio',url:linked.url,start:t,duration:linked.duration-off,srcStart:linked.type==='image'?0:linked.srcStart+off,srcDuration:linked.srcDuration,trackId:linked.trackId,origW:0,origH:0,linkId:newId,linkedTo:newId}; linked.duration=off; this.transforms[nLid]={...(this.transforms[linked.id]||this.defaultTransform)}; this.audioElements[nLid]=new Audio(nL.url); this.clips.splice(this.clips.indexOf(linked)+1,0,nL); nc.linkId=nLid; nc.linkedTo=nLid; nL.linkId=newId; nL.linkedTo=newId; }
    this.clips.splice(this.clips.indexOf(cl)+1,0,nc); newIds.push(newId);
  });
  if(newIds.length){ this.selectedIds=new Set(newIds); this.selectedId=newIds[0]; }
  this.renderAll(); this.syncToTimeline();
 }
 seekTimelineFromEvent(e){
  const rect=this.ruler.getBoundingClientRect(); const scroll=this.ruler.scrollLeft; const x=e.clientX-rect.left+scroll;
  this.timelineTime=Math.max(0,x/this.pixelsPerSecond); this.syncToTimeline(); this.updatePlayheadPos();
 }
 getClipsAtTimeline(t){
  const cov=this.clips.filter(c=>{ const track=this.allTracks.find(tr=>tr.id===c.trackId); if(track&&track.enabled===false) return false; return t>=c.start&&t<c.start+c.duration-0.001; });
  cov.sort((a,b)=>{ const ta=this.allTracks.find(tr=>tr.id===a.trackId); const tb=this.allTracks.find(tr=>tr.id===b.trackId); if(!ta||!tb) return 0; if(ta.type!=='audio'&&tb.type==='audio') return -1; if(ta.type!=='audio'&&tb.type!=='audio') return ta.num-tb.num; return 1; });
  return cov;
 }
 getNextTimeAfter(t){ let n=null; for(let i=0;i<this.clips.length;i++){ const c=this.clips[i]; const tr=this.allTracks.find(tr=>tr.id===c.trackId); if(tr&&tr.enabled===false) continue; if(c.start>t+0.001){ if(!n||c.start<n) n=c.start; } } return n; }
 syncToTimeline(){
  if(!this.clips.length){ this.layersBox.querySelectorAll('.layer-item').forEach(e=>{ if(e.tagName==='VIDEO') e.pause(); e.remove(); }); this.layerElements={}; Object.values(this.textElements).forEach(el=>el.style.display='none'); Object.values(this.audioElements).forEach(a=>a.pause()); return; }
  const cov=this.getClipsAtTimeline(this.timelineTime);
  const visualClips=cov.filter(c=>c.type==='video'||c.type==='image').sort((a,b)=>{ const ta=this.allTracks.find(t=>t.id===a.trackId); const tb=this.allTracks.find(t=>t.id===b.trackId); return (ta?.num||0)-(tb?.num||0); });
  const wantedIds=new Set(visualClips.map(c=>c.id));
  Object.keys(this.layerElements).forEach(id=>{
    const exists=visualClips.find(c=>c.id==id);
    if(!exists){ const el=this.layerElements[id]; if(el){ if(el.tagName==='VIDEO') el.pause(); el.remove(); } delete this.layerElements[id]; }
  });
  if(visualClips.length===0){ const ph=document.getElementById('placeholder'); if(ph) ph.style.display=this.clips.length?'none':'block'; this.layersBox.style.background='#111'; }else{ const ph2=document.getElementById('placeholder'); if(ph2) ph2.style.display='none'; this.layersBox.style.background='#000'; }
  visualClips.forEach(clip=>{
    let el=this.layerElements[clip.id];
    if(!el){
      if(clip.type==='image'){ el=document.createElement('img'); el.src=clip.url; }
      else{ el=document.createElement('video'); el.src=clip.url; const linked=this.getLinkedClip(clip); el.muted=linked?true:false; el.playsInline=true; el.preload='auto'; }
      el.className='layer-item'; el.dataset.clipId=clip.id; el.style.position='absolute'; el.style.left='0'; el.style.top='0'; el.style.width='100%'; el.style.height='100%'; el.style.objectFit='contain'; el.style.objectPosition='center center'; el.style.background='transparent';
      const tr=this.transforms[clip.id]||this.defaultTransform; const sx=(tr.scale||1)*(tr.scaleX||1); const sy=(tr.scale||1)*(tr.scaleY||1);
      el.style.transform=`translate(${tr.x}px,${tr.y}px) scaleX(${sx}) scaleY(${sy}) rotate(${tr.rot}deg)`; el.style.transformOrigin='center center';
      const track=this.allTracks.find(t=>t.id===clip.trackId); el.style.zIndex=track?track.num:1;
      this.layersBox.appendChild(el); this.layerElements[clip.id]=el;
    }else{ if(el.tagName==='VIDEO'){ const lk=this.getLinkedClip(clip); el.muted=lk?true:false; } }
    if(clip.type==='video'){
      const off=this.timelineTime-clip.start; const target=clip.srcStart+off; const maxT=clip.srcStart+clip.duration; const clamped=Math.min(target, maxT-0.05);
      if(!this.isPlaying){ if(Math.abs(el.currentTime-clamped)>0.25){ try{ el.currentTime=clamped; }catch(e){} } el.pause(); }else{ if(Math.abs(el.currentTime-clamped)>0.5){ try{ el.currentTime=clamped; }catch(e){} } el.play().catch(()=>{ el.muted=true; el.play().catch(()=>{}); }); }
    }
    const track=this.allTracks.find(t=>t.id===clip.trackId); if(track) el.style.zIndex=track.num;
  });
  Object.values(this.textElements).forEach(el=>el.style.display='none');
  cov.filter(c=>c.type==='text').forEach(clip=>{
    const track=this.allTracks.find(t=>t.id===clip.trackId); if(track&&track.enabled===false) return;
    let el=this.textElements[clip.id]; if(!el){ el=document.createElement('div'); el.className='text-overlay'; el.dataset.clipId=clip.id; el.dataset.textId=clip.id; el.dataset.baseTransform='translate(-50%,-50%)'; el.style.position='absolute'; el.style.left='50%'; el.style.top='50%'; el.style.zIndex='35'; el.style.padding='6px 12px'; el.style.borderRadius='8px'; this.textLayer.appendChild(el); this.textElements[clip.id]=el; el.addEventListener('mousedown',e=>{ this.selectText(clip.id); e.stopPropagation(); }); }
    let st=this.textStyles[clip.id]; if(!st){ st={id:clip.id,text:clip.text||'Texto',font:'Inter, system-ui, sans-serif',size:32,color:'#ffffff',bg:'#000000',bgAlpha:0.35,weight:'700',align:'center'}; this.textStyles[clip.id]=st; }
    el.textContent=st.text; el.style.fontFamily=st.font; el.style.fontSize=st.size+'px'; el.style.color=st.color; el.style.fontWeight=st.weight; el.style.textAlign=st.align; el.style.display='block';
    const bgAlpha=parseFloat(st.bgAlpha); if(bgAlpha===0) el.style.background='transparent'; else el.style.background=`rgba(${parseInt(st.bg.slice(1,3),16)},${parseInt(st.bg.slice(3,5),16)},${parseInt(st.bg.slice(5,7),16)},${bgAlpha})`;
    const tr=this.transforms[clip.id]||this.defaultTransform; const sx=(tr.scale||1)*(tr.scaleX||1); const sy=(tr.scale||1)*(tr.scaleY||1);
    el.style.transform=`translate(-50%,-50%) translate(${tr.x}px,${tr.y}px) scaleX(${sx}) scaleY(${sy}) rotate(${tr.rot}deg)`;
    if(clip.id===this.selectedTextId) el.classList.add('selected');
  });
  const played=new Set();
  cov.filter(c=>c.type==='audio').forEach(c=>{
    if(played.has(c.id)) return; played.add(c.id);
    const a=this.audioElements[c.id]; if(!a) return;
    const off=this.timelineTime-c.start; const st=c.srcStart+off; const maxSt=c.srcStart+c.duration; const clamped=Math.min(st, maxSt-0.05);
    if(Math.abs(a.currentTime-clamped)>0.35) try{a.currentTime=clamped;}catch(e){}
    if(this.isPlaying) a.play().catch(()=>{}); else a.pause();
  });
  this.clips.filter(c=>c.type==='audio').forEach(c=>{ if(!cov.find(x=>x.id===c.id)){ const a=this.audioElements[c.id]; if(a) a.pause(); } });
  const pt=document.getElementById('preview-time'); if(pt){ const maxEnd=Math.max(...this.clips.map(c=>c.start+c.duration),0); pt.textContent=this.format(this.timelineTime)+' / '+this.format(maxEnd); }
 }
 updatePlayheadPos(){
  const px=this.timelineTime*this.pixelsPerSecond;
  if(this.playhead){ this.playhead.style.left=px+'px'; this.playhead.style.display='block'; }
  if(this.cursor){ this.cursor.style.left=px+'px'; this.cursor.style.display='block'; }
  const maxEnd=Math.max(...this.clips.map(c=>c.start+c.duration),0);
  if(this.timeDisplay) this.timeDisplay.textContent=this.format(this.timelineTime)+' / '+this.format(maxEnd);
 }
 togglePlay(){ if(this.isPlaying) this.pause(); else this.play(); }
 play(){
  if(!this.clips.length) return; const maxEnd=Math.max(...this.clips.map(c=>c.start+c.duration)); if(this.timelineTime>=maxEnd-0.05) this.timelineTime=0;
  this.isPlaying=true; this.lastTick=performance.now(); this.syncToTimeline();
  const pi=document.getElementById('play-icon'); if(pi) pi.textContent='⏸'; const pm=document.getElementById('play-btn-main'); if(pm) pm.textContent='⏸';
  const loop=now=>{
    if(!this.isPlaying) return;
    const dt=(now-this.lastTick)/1000; this.lastTick=now; this.timelineTime+=dt;
    const curCov=this.getClipsAtTimeline(this.timelineTime);
    if(!curCov.length){ const nxt=this.getNextTimeAfter(this.timelineTime); if(nxt!=null){ this.timelineTime=nxt; this.syncToTimeline(); } else{ this.pause(); return; } }
    this.updatePlayheadPos(); this.raf=requestAnimationFrame(loop);
  }; this.raf=requestAnimationFrame(loop);
 }
 pause(){ this.isPlaying=false; Object.values(this.layerElements).forEach(el=>{ if(el.tagName==='VIDEO') el.pause(); }); Object.values(this.audioElements).forEach(a=>a.pause()); if(this.raf) cancelAnimationFrame(this.raf); const pi=document.getElementById('play-icon'); if(pi) pi.textContent='▶'; const pm=document.getElementById('play-btn-main'); if(pm) pm.textContent='▶'; }
 renderAll(){ this.renderRuler(); this.renderTracks(); }
 addTrack(type){ if(type==='video'){ const n=this.videoTracks.length+1; this.videoTracks.push({id:'v'+Date.now()+n,name:'V'+n,type:'video',icon:'🎬',num:n,enabled:true}); }else{ const n=this.audioTracks.length+1; this.audioTracks.push({id:'a'+Date.now()+n,name:'A'+n,type:'audio',icon:'🎵',num:n,enabled:true}); } this.renderTracks(); this.updateMetrics(); this.renderClips(); this.pushHistory('Pista'); this.updateImportSelectors(); }
 addText(){
  const id=Date.now()+Math.random(); let sel=this.getSelectedImportTrack(); let trackId='v1';
  if(sel&&sel!=='auto'&&sel!=='newV'&&sel!=='newA'&&this.allTracks.find(t=>t.id===sel&&t.type!=='audio')) trackId=sel; else trackId=this.videoTracks[0]?this.videoTracks[0].id:'v1';
  const clip={id,name:'Texto '+(this.clips.filter(c=>c.type==='text').length+1),type:'text',url:'',start:this.timelineTime,duration:4,srcStart:0,srcDuration:4,trackId,origW:0,origH:0,linkId:null,linkedTo:null,text:'Tu texto aquí'};
  this.clips.push(clip); this.transforms[id]={...this.defaultTransform}; this.textStyles[id]={id,text:'Tu texto aquí',font:'Inter, system-ui, sans-serif',size:36,color:'#ffffff',bg:'#000000',bgAlpha:0.35,weight:'700',align:'center'};
  this.duration=Math.max(this.duration,clip.start+clip.duration); this.updateMetrics(); this.renderAll(); this.selectText(id); this.syncToTimeline(); this.pushHistory('Agregar texto en V');
 }
 format(s){ const m=Math.floor(s/60); const sec=Math.floor(s%60); const ms=Math.floor((s%1)*10); return m+':'+String(sec).padStart(2,'0')+'.'+ms; }
 init(){
  const input=document.getElementById('file-input'); const stage=this.previewStage;
  if(stage){ stage.addEventListener('dragover',e=>e.preventDefault()); stage.addEventListener('drop',e=>{e.preventDefault(); if(e.dataTransfer.files.length) this.handleFiles(e.dataTransfer.files);}); }
  const ph=document.getElementById('placeholder'); if(ph) ph.addEventListener('click',()=>input.click());
  const safe=(id,ev,fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener(ev,fn); };
  safe('import-btn','click',()=>input.click()); safe('tb-import','click',()=>input.click());
  safe('tb-split','click',()=>this.splitAtPlayhead()); safe('tb-del','click',()=>this.deleteSelected()); safe('tb-text','click',()=>this.addText());
  safe('m-undo','click',()=>this.undo()); safe('m-redo','click',()=>this.redo()); safe('m-copy','click',()=>this.copySelected()); safe('m-cut','click',()=>this.cutSelected()); safe('m-paste','click',()=>this.pasteAtPlayhead()); safe('m-del','click',()=>this.deleteSelected()); safe('m-split','click',()=>this.splitAtPlayhead());
  safe('m-fit','click',()=>this.zoomFit()); safe('m-detail','click',()=>this.zoomDetail());
  safe('m-exp-dialog','click',()=>this.exportMgr.openDialog());
  safe('export-btn','click',()=>this.exportMgr.openDialog()); safe('export-btn2','click',()=>this.exportMgr.openDialog());
  safe('confirm-export','click',()=>this.exportMgr.exportVideo());
  safe('c-copy','click',()=>this.copySelected()); safe('c-cut','click',()=>this.cutSelected()); safe('c-paste','click',()=>this.pasteAtPlayhead()); safe('c-del','click',()=>this.deleteSelected()); safe('c-clear-sel','click',()=>this.clearSelection());
  safe('ctx-copy','click',()=>{this.copySelected(); hideContext();}); safe('ctx-cut','click',()=>{this.cutSelected(); hideContext();}); safe('ctx-paste','click',()=>{this.pasteAtPlayhead(); hideContext();}); safe('ctx-split','click',()=>{this.splitAtPlayhead(); hideContext();}); safe('ctx-del','click',()=>{this.deleteSelected(); hideContext();}); safe('ctx-fit','click',()=>{this.zoomFit(); hideContext();}); safe('ctx-dup','click',()=>{this.duplicateSelected(); hideContext();}); safe('ctx-clear','click',()=>{this.clearSelection(); hideContext();});
  if(input) input.addEventListener('change',e=>{ this.handleFiles(e.target.files); e.target.value=''; });
  const playBtns=[document.getElementById('play-btn'),document.getElementById('play-btn-main')]; playBtns.forEach(b=>{ if(b) b.addEventListener('click',()=>this.togglePlay()); });
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'&&e.target.type!=='range'){ if(!(e.ctrlKey||e.metaKey)) return; }
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'&&!e.shiftKey){ e.preventDefault(); this.undo(); }
    else if((e.ctrlKey||e.metaKey)&&(e.code==='KeyZ'&&e.shiftKey||e.code==='KeyY')){ e.preventDefault(); this.redo(); }
    else if((e.ctrlKey||e.metaKey)&&e.code==='KeyC'){ e.preventDefault(); this.copySelected(); }
    else if((e.ctrlKey||e.metaKey)&&e.code==='KeyX'){ e.preventDefault(); this.cutSelected(); }
    else if((e.ctrlKey||e.metaKey)&&e.code==='KeyV'){ e.preventDefault(); this.pasteAtPlayhead(); }
    else if((e.ctrlKey||e.metaKey)&&e.code==='KeyA'){ e.preventDefault(); this.selectedIds=new Set(this.clips.map(c=>c.id)); this.renderClips(); this.updateSelectionInfo(); }
    else if(e.code==='Space'&&!e.ctrlKey&&e.target.tagName!=='INPUT'){ e.preventDefault(); this.togglePlay(); }
    else if(e.code==='KeyS'&&!e.ctrlKey&&e.target.tagName!=='INPUT'){ e.preventDefault(); this.splitAtPlayhead(); }
    else if((e.code==='Delete'||e.code==='Backspace')&&!e.ctrlKey){ if(e.target.tagName!=='INPUT'&&(this.selectedId||this.selectedIds.size)){ e.preventDefault(); this.deleteSelected(); } }
    else if(e.code==='Escape') this.clearSelection();
  });
  // Fix playhead only ruler handled by TimelineManager
  const tracksContainer=document.getElementById('timeline-tracks');
  if(tracksContainer){
    tracksContainer.addEventListener('scroll',()=>{ if(this.ruler) this.ruler.scrollLeft=tracksContainer.scrollLeft; });
  }
  if(this.ruler) this.ruler.addEventListener('scroll',()=>{ if(this.tracksContainer) this.tracksContainer.scrollLeft=this.ruler.scrollLeft; });
  const cursor=document.getElementById('single-cursor');
  if(cursor) cursor.addEventListener('mousedown',e=>{ this.dragState={type:'playhead'}; e.preventDefault(); });
  document.addEventListener('mousemove',e=>this.onMouseMove(e)); document.addEventListener('mouseup',()=>this.onMouseUp());
  safe('zoom-in','click',()=>this.zoomIn()); safe('zoom-out','click',()=>this.zoomOut()); safe('zoom-fit','click',()=>this.zoomFit()); safe('zoom-detail','click',()=>this.zoomDetail());
  safe('zoom-fit-btn','click',()=>this.zoomFit()); safe('zoom-detail-btn','click',()=>this.zoomDetail());
  const zs=document.getElementById('zoom-slider'); if(zs) zs.addEventListener('input',e=>this.setZoom(parseInt(e.target.value)));
  safe('preview-zoom-in','click',()=>this.setPreviewZoom(this.previewZoom*1.2)); safe('preview-zoom-out','click',()=>this.setPreviewZoom(this.previewZoom/1.2)); safe('preview-fit','click',()=>this.setPreviewZoom(1));
  const pzs=document.getElementById('preview-zoom-slider'); if(pzs) pzs.addEventListener('input',e=>this.setPreviewZoom(parseInt(e.target.value)/100));
  this.previewStage.addEventListener('wheel',e=>{ if(e.ctrlKey||e.altKey){ e.preventDefault(); const d=e.deltaY>0?0.9:1.1; this.setPreviewZoom(this.previewZoom*d); } }, {passive:false});
  tracksContainer.addEventListener('wheel',e=>{ if(e.ctrlKey||e.metaKey){ e.preventDefault(); const d=e.deltaY>0?0.9:1.1; this.setZoom(this.pixelsPerSecond*d); } }, {passive:false});
  document.querySelectorAll('.aspect-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ document.querySelectorAll('.aspect-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); this.setAspect(btn.dataset.ratio); }); });
  safe('res-select','change',e=>this.setResolution(e.target.value)); safe('apply-size','click',()=>this.applyCustomSize());
  safe('add-v-track','click',()=>this.addTrack('video')); safe('add-a-track','click',()=>this.addTrack('audio'));
  const sel1=document.getElementById('import-track-select'); const sel2=document.getElementById('import-track-select2');
  if(sel1) sel1.addEventListener('change',()=>{ if(sel2) sel2.value=sel1.value; });
  if(sel2) sel2.addEventListener('change',()=>{ if(sel1) sel1.value=sel2.value; });
  this.tracksContainer.addEventListener('contextmenu',e=>{ e.preventDefault(); const clipEl=e.target.closest?e.target.closest('.clip'):null; if(clipEl){ const id=clipEl.dataset.id; const cl=this.clips.find(c=>c.id==id); if(!this.selectedIds.has(id)){ if(cl&&cl.type==='text') this.selectText(id); else this.selectClip(id); } } this.showContextMenu(e.clientX,e.clientY); });
  this.previewStage.addEventListener('contextmenu',e=>{ e.preventDefault(); this.showContextMenu(e.clientX,e.clientY); });
  const wrapper=document.getElementById('timeline-wrapper');
  if(wrapper){
    wrapper.addEventListener('dragover',e=>e.preventDefault());
    wrapper.addEventListener('drop',e=>{
      if(e.dataTransfer.files.length){
        e.preventDefault();
        const targetId=this.getTrackAtY(e.clientY);
        if(targetId) this.handleFiles(e.dataTransfer.files, targetId); else this.handleFiles(e.dataTransfer.files);
      }
    });
  }
  this.transformMgr.bind(); this.bindTextEdit(); this.transformMgr.initDragPreview();
  this.setResolution('1080p'); this.setAspect('16-9'); this.renderTracks(); this.updateMetrics(); this.renderRuler(); this.updatePlayheadPos(); this.updateImportSelectors();
  this.pushHistory('Inicio v21 PRO magnet+rango+MP4 fix');
 }
 bindTextEdit(){
  const els={content:document.getElementById('txt-content'),font:document.getElementById('txt-font'),size:document.getElementById('txt-size'),sizeNum:document.getElementById('txt-size-num'),color:document.getElementById('txt-color'),colorTxt:document.getElementById('txt-color-txt'),bg:document.getElementById('txt-bg'),bgAlpha:document.getElementById('txt-bg-alpha'),weight:document.getElementById('txt-weight'),align:document.getElementById('txt-align')};
  const getStyle=()=>{ const id=this.selectedTextId||this.selectedId; if(!id) return null; if(!this.textStyles[id]) this.textStyles[id]={id,text:'Texto',font:'Inter, system-ui, sans-serif',size:32,color:'#ffffff',bg:'#000000',bgAlpha:0.35,weight:'700',align:'center'}; return this.textStyles[id]; };
  const applyToEl=()=>{ const st=getStyle(); if(!st) return; const el=this.textElements[st.id]||this.textElements[this.selectedTextId]||document.querySelector('.text-overlay.selected'); if(!el) return; el.textContent=st.text; el.style.fontFamily=st.font; el.style.fontSize=st.size+'px'; el.style.color=st.color; el.style.fontWeight=st.weight; el.style.textAlign=st.align; const bgAlpha=parseFloat(st.bgAlpha); if(bgAlpha===0) el.style.background='transparent'; else el.style.background=`rgba(${parseInt(st.bg.slice(1,3),16)},${parseInt(st.bg.slice(3,5),16)},${parseInt(st.bg.slice(5,7),16)},${bgAlpha})`; const clip=this.clips.find(c=>c.id==st.id); if(clip) clip.text=st.text; };
  const syncUI=()=>{ const st=getStyle(); if(!st) return; if(els.content) els.content.value=st.text; if(els.font) els.font.value=st.font; if(els.size) els.size.value=st.size; if(els.sizeNum) els.sizeNum.value=st.size; if(els.color) els.color.value=st.color; if(els.colorTxt) els.colorTxt.value=st.color; if(els.bg) els.bg.value=st.bg; if(els.bgAlpha) els.bgAlpha.value=st.bgAlpha; if(els.weight) els.weight.value=st.weight; if(els.align) els.align.value=st.align; };
  this._syncTextUI=syncUI; this._applyText=applyToEl;
  if(els.content) els.content.addEventListener('input',e=>{ const st=getStyle(); if(!st) return; st.text=e.target.value; const clip=this.clips.find(c=>c.id==st.id); if(clip) clip.text=e.target.value; applyToEl(); this.renderClips(); });
  if(els.font) els.font.addEventListener('change',e=>{ const st=getStyle(); if(!st) return; st.font=e.target.value; applyToEl(); });
  const sizeChange=v=>{ const st=getStyle(); if(!st) return; st.size=parseInt(v); applyToEl(); if(els.size) els.size.value=v; if(els.sizeNum) els.sizeNum.value=v; };
  if(els.size) els.size.addEventListener('input',e=>sizeChange(e.target.value)); if(els.sizeNum) els.sizeNum.addEventListener('input',e=>sizeChange(e.target.value));
  if(els.color) els.color.addEventListener('input',e=>{ const st=getStyle(); if(!st) return; st.color=e.target.value; if(els.colorTxt) els.colorTxt.value=e.target.value; applyToEl(); });
  if(els.colorTxt) els.colorTxt.addEventListener('input',e=>{ const st=getStyle(); if(!st) return; st.color=e.target.value; if(els.color) els.color.value=e.target.value; applyToEl(); });
  if(els.bg) els.bg.addEventListener('input',e=>{ const st=getStyle(); if(!st) return; st.bg=e.target.value; applyToEl(); });
  if(els.bgAlpha) els.bgAlpha.addEventListener('change',e=>{ const st=getStyle(); if(!st) return; st.bgAlpha=e.target.value; applyToEl(); });
  if(els.weight) els.weight.addEventListener('change',e=>{ const st=getStyle(); if(!st) return; st.weight=e.target.value; applyToEl(); });
  if(els.align) els.align.addEventListener('change',e=>{ const st=getStyle(); if(!st) return; st.align=e.target.value; applyToEl(); });
 }
}

function hideContext(){ const m=document.getElementById('context-menu'); if(m) m.style.display='none'; }
document.addEventListener('click',()=>{ hideContext(); document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('open')); });
document.querySelectorAll('.menu-btn').forEach(btn=>{ btn.addEventListener('click',e=>{ e.stopPropagation(); const item=btn.parentElement; const wasOpen=item.classList.contains('open'); document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('open')); if(!wasOpen) item.classList.add('open'); }); });

document.addEventListener('DOMContentLoaded',()=>{ window.editor=new VideoEditor(); });
