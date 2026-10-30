export class TimelineManager {
 constructor(editor){
  this.editor=editor;
  this.snapEnabled=true;
  this.snapThreshold=0.12; // seconds
  this.boxSelect={active:false,startX:0,startY:0,el:null};
  this.init();
 }
 getSnapTargets(excludeIds=[]){
  const editor=this.editor;
  const targets=[];
  editor.clips.forEach(c=>{
    if(excludeIds.includes(c.id)) return;
    targets.push(c.start);
    targets.push(c.start+c.duration);
  });
  targets.push(editor.timelineTime); // playhead
  targets.push(0);
  return [...new Set(targets)].sort((a,b)=>a-b);
 }
 applySnap(time, excludeIds){
  if(!this.snapEnabled) return time;
  const targets=this.getSnapTargets(excludeIds);
  let best=time, bestDiff=this.snapThreshold;
  for(let t of targets){
    const diff=Math.abs(time-t);
    if(diff<bestDiff){ bestDiff=diff; best=t; }
  }
  if(best!==time){
    this.showSnapIndicator(best);
    return best;
  }
  this.hideSnapIndicator();
  return time;
 }
 showSnapIndicator(time){
  let ind=document.getElementById('snap-indicator');
  if(!ind){
    ind=document.createElement('div'); ind.id='snap-indicator'; ind.className='snap-indicator';
    document.getElementById('timeline-tracks').appendChild(ind);
  }
  ind.style.left=(time*this.editor.pixelsPerSecond)+'px';
  ind.style.display='block';
 }
 hideSnapIndicator(){
  const ind=document.getElementById('snap-indicator');
  if(ind) ind.style.display='none';
 }
 init(){
  const editor=this.editor;
  const ruler=document.getElementById('timeline-ruler');
  const tracksContainer=document.getElementById('timeline-tracks');
  const magnetBtn=document.getElementById('magnet-toggle');
  if(magnetBtn){
    magnetBtn.classList.add('magnet-on');
    magnetBtn.onclick=()=>{
      this.snapEnabled=!this.snapEnabled;
      magnetBtn.classList.toggle('magnet-on', this.snapEnabled);
      magnetBtn.textContent=this.snapEnabled ? '🧲 Magnet ON' : '🧲 Magnet OFF';
    };
  }
  // Ruler only moves playhead
  if(ruler){
    ruler.addEventListener('mousedown',e=>{
      if(e.button!==0) return;
      editor.seekTimelineFromEvent(e);
      editor.dragState={type:'playhead'};
      e.preventDefault();
    });
    ruler.addEventListener('click',e=>editor.seekTimelineFromEvent(e));
  }
  // Box selection on empty timeline area
  if(tracksContainer){
    tracksContainer.addEventListener('mousedown',e=>{
      if(e.target.closest && e.target.closest('.clip')) return; // clip drag handled elsewhere
      if(e.button!==0) return;
      const rect=tracksContainer.getBoundingClientRect();
      const startX=e.clientX-rect.left+tracksContainer.scrollLeft;
      const startY=e.clientY-rect.top+tracksContainer.scrollTop;
      this.boxSelect.active=true;
      this.boxSelect.startX=startX; this.boxSelect.startY=startY;
      let box=document.getElementById('selection-box');
      if(!box){
        box=document.createElement('div'); box.id='selection-box';
        tracksContainer.appendChild(box);
      }
      box.style.display='block';
      box.style.left=startX+'px'; box.style.top=startY+'px';
      box.style.width='0px'; box.style.height='0px';
      this.boxSelect.el=box;
      e.preventDefault();
    });
  }
  document.addEventListener('mousemove',e=>{
    if(this.boxSelect.active){
      const tracksContainer=document.getElementById('timeline-tracks');
      if(!tracksContainer) return;
      const rect=tracksContainer.getBoundingClientRect();
      const curX=e.clientX-rect.left+tracksContainer.scrollLeft;
      const curY=e.clientY-rect.top+tracksContainer.scrollTop;
      const box=this.boxSelect.el;
      if(!box) return;
      const x=Math.min(curX,this.boxSelect.startX);
      const y=Math.min(curY,this.boxSelect.startY);
      const w=Math.abs(curX-this.boxSelect.startX);
      const h=Math.abs(curY-this.boxSelect.startY);
      box.style.left=x+'px'; box.style.top=y+'px'; box.style.width=w+'px'; box.style.height=h+'px';
      // Select clips intersecting
      const clips=document.querySelectorAll('.clip');
      clips.forEach(clipEl=>{
        const cRect=clipEl.getBoundingClientRect();
        const tRect=tracksContainer.getBoundingClientRect();
        const clipX=cRect.left - tRect.left + tracksContainer.scrollLeft;
        const clipY=cRect.top - tRect.top + tracksContainer.scrollTop;
        const clipW=cRect.width; const clipH=cRect.height;
        const intersect=!(clipX+clipW < x || clipX > x+w || clipY+clipH < y || clipY > y+h);
        const id=clipEl.dataset.id;
        if(intersect){
          if(!editor.selectedIds.has(id)){
            editor.selectedIds.add(id);
          }
        }
      });
      editor.renderClips(); editor.updateSelectionInfo();
    }
  });
  document.addEventListener('mouseup',()=>{
    if(this.boxSelect.active){
      this.boxSelect.active=false;
      const box=document.getElementById('selection-box');
      if(box) box.style.display='none';
      this.hideSnapIndicator();
    }
  });
 }
}
