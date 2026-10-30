export class ExportManager {
 constructor(editor){
  this.editor = editor;
  this.selectedQuality = 'original';
  this.selectedFormat = 'mp4'; // mp4 preferred
  this.detectSupportedMime();
 }
 detectSupportedMime(){
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264',
    'video/webm',
  ];
  this.supportedMp4 = mp4Candidates.find(m=>{ try{return MediaRecorder.isTypeSupported(m);}catch(e){return false;}});
  this.supportedWebm = webmCandidates.find(m=>{ try{return MediaRecorder.isTypeSupported(m);}catch(e){return false;}});
  this.defaultMime = this.supportedMp4 || this.supportedWebm || 'video/webm';
 }
 getExportSize(quality){
  const e=this.editor;
  let w,h;
  if(quality==='original'){ w=e.projectW; h=e.projectH; }
  else{
    const map={ '480p':{w:854,h:480}, '720p':{w:1280,h:720}, '1080p':{w:1920,h:1080}};
    const q=map[quality]||map['720p'];
    if(e.aspectRatio==='9-16'){ w=Math.round(q.h*9/16); h=q.h; }
    else if(e.aspectRatio==='1-1'){ w=q.w; h=q.w; }
    else if(e.aspectRatio==='4-5'){ w=Math.round(q.h*4/5); h=q.h; }
    else { w=q.w; h=q.h; }
  }
  return {w,h};
 }
 openDialog(){
  const modal=document.getElementById('export-options-modal');
  const od=document.getElementById('opt-original-desc');
  if(od) od.textContent=this.editor.projectW+'x'+this.editor.projectH+' (W/H exacto)';
  const mp4Info=document.getElementById('mp4-support-info');
  if(mp4Info) mp4Info.textContent = this.supportedMp4 ? '✅ MP4 H.264 soportado' : '⚠️ MP4 no soportado, se usará WEBM';
  modal.classList.add('show');
  const self=this;
  modal.querySelectorAll('.export-option[data-quality]').forEach(opt=>{
    opt.onclick=()=>{
      modal.querySelectorAll('.export-option[data-quality]').forEach(o=>o.classList.remove('selected'));
      opt.classList.add('selected'); self.selectedQuality=opt.dataset.quality;
    };
  });
  modal.querySelectorAll('.export-option[data-format]').forEach(opt=>{
    opt.onclick=()=>{
      modal.querySelectorAll('.export-option[data-format]').forEach(o=>o.classList.remove('selected'));
      opt.classList.add('selected'); self.selectedFormat=opt.dataset.format;
    };
  });
 }
 async exportVideo(){
  const editor=this.editor;
  const quality=this.selectedQuality||'original';
  let format=this.selectedFormat||'mp4';
  const modal=document.getElementById('export-modal');
  const status=document.getElementById('export-status');
  const progress=document.getElementById('export-progress');
  const link=document.getElementById('download-link');
  const details=document.getElementById('export-details');
  const preview=document.getElementById('export-preview');
  const optModal=document.getElementById('export-options-modal');
  if(optModal) optModal.classList.remove('show');
  modal.classList.add('show'); link.style.display='none'; if(preview) preview.style.display='none'; progress.style.width='0%';
  if(!editor.clips.length){ status.textContent='No hay clips'; return; }
  editor.pause();
  try{
    const canvas=document.getElementById('export-canvas');
    const {w:exportW, h:exportH}=this.getExportSize(quality);
    canvas.width=exportW; canvas.height=exportH;
    const ctx=canvas.getContext('2d');

    // Mime selection: prefer MP4 H.264
    let mime;
    if(format==='mp4' && this.supportedMp4) mime=this.supportedMp4;
    else if(format==='webm' && this.supportedWebm) mime=this.supportedWebm;
    else mime=this.defaultMime;
    // If requested format not supported, fallback
    if(format==='mp4' && !this.supportedMp4){ mime=this.supportedWebm; format='webm'; }
    if(details) details.textContent=`Proyecto ${editor.projectW}x${editor.projectH} → Export ${exportW}x${exportH} ${quality.toUpperCase()} ${mime} - Fix 1x velocidad`;

    // Use captureStream(0) = manual frame mode -> fixes slow & duration extension bug
    let stream;
    try{ stream=canvas.captureStream(0); }catch(e){ stream=canvas.captureStream(30); }
    const videoTrack = stream.getVideoTracks()[0];

    // Audio: continuous via AudioContext
    let audioCtx=null, dest=null, gainNodes=[], audioTracksAdded=0;
    try{
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      dest=audioCtx.createMediaStreamDestination();
      editor.clips.filter(c=>c.type==='audio').forEach(clip=>{
        const track=editor.allTracks.find(t=>t.id===clip.trackId); if(track&&track.enabled===false) return;
        let a=editor.audioElements[clip.id]; if(!a){ a=new Audio(clip.url); editor.audioElements[clip.id]=a; }
        try{ a.crossOrigin='anonymous'; }catch(e){}
        try{
          if(!a._exportConnected){
            const src=audioCtx.createMediaElementSource(a);
            const gain=audioCtx.createGain(); gain.gain.value=0;
            src.connect(gain); gain.connect(dest); gain.connect(audioCtx.destination);
            a._exportSrc=src; a._exportGain=gain; a._exportConnected=true;
            gainNodes.push({clip,a,gain}); audioTracksAdded++;
          }else{
            gainNodes.push({clip,a,gain:a._exportGain});
          }
        }catch(e){ console.log('audio ctx',e.message); }
      });
      if(dest.stream.getAudioTracks().length>0){
        dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
      }
    }catch(e){ console.log('AudioContext fail',e); }

    const recorder=new MediaRecorder(stream,{mimeType:mime, videoBitsPerSecond: quality==='480p'?3000000:quality==='720p'?6000000:10000000});
    const chunks=[]; recorder.ondataavailable=e=>{ if(e.data.size>0) chunks.push(e.data); };
    recorder.onstop=()=>{
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const blob=new Blob(chunks,{type:mime}); const url=URL.createObjectURL(blob);
      link.href=url; link.download=`loveholic_export_${exportW}x${exportH}_${quality}.${ext}`;
      link.style.display='flex'; link.textContent=`⬇ Descargar ${exportW}x${exportH} ${quality.toUpperCase()} ${ext.toUpperCase()} (${(blob.size/1024/1024).toFixed(2)}MB)`;
      if(preview){ preview.src=url; preview.style.display='block'; }
      status.textContent=`¡Export listo! ${exportW}x${exportH} ${quality.toUpperCase()} ${ext.toUpperCase()} - 1x velocidad fija - Sin extensión de duración`;
      progress.style.width='100%';
      if(audioCtx) try{audioCtx.close();}catch(e){}
      Object.values(editor.audioElements).forEach(a=>{ a._exportConnected=false; if(a._exportGain) try{a._exportGain.disconnect();}catch(e){} });
    };
    recorder.start(100);
    const totalDuration=Math.max(...editor.clips.map(c=>c.start+c.duration),0);
    let exportedTime=0;
    // Preload videos for export (pause)
    editor.clips.filter(c=>c.type==='video').forEach(c=>{
      let el=editor.layerElements[c.id];
      if(!el){ el=document.createElement('video'); el.src=c.url; el.muted=true; el.playsInline=true; el.preload='auto'; el.crossOrigin='anonymous'; document.body.appendChild(el); el.style.display='none'; editor.layerElements[c.id]=el; }
      el.pause();
    });
    gainNodes.forEach(g=>{ try{ g.a.currentTime=g.clip.srcStart; g.a.play().catch(()=>{}); g.gain.gain.value=0; }catch(e){} });

    const exportLoop=()=>{
      if(exportedTime>=totalDuration){
        recorder.stop(); editor.timelineTime=0; editor.syncToTimeline(); status.textContent+=' - Finalizando...'; return;
      }
      editor.timelineTime=exportedTime;
      gainNodes.forEach(g=>{
        const active=exportedTime>=g.clip.start && exportedTime<g.clip.start+g.clip.duration;
        try{ g.gain.gain.value=active?1:0; }catch(e){}
      });
      editor.syncToTimeline();
      const cov=editor.getClipsAtTimeline(exportedTime);
      const visuals=cov.filter(c=>c.type==='video'||c.type==='image').sort((a,b)=>{
        const ta=editor.allTracks.find(t=>t.id===a.trackId); const tb=editor.allTracks.find(t=>t.id===b.trackId);
        return (ta?.num||0)-(tb?.num||0);
      });
      visuals.forEach(clip=>{
        if(clip.type==='video'){
          const el=editor.layerElements[clip.id];
          if(el){ const off=exportedTime-clip.start; const target=clip.srcStart+off; const maxT=clip.srcStart+clip.duration; const clamped=Math.min(Math.max(target,0), maxT-0.01); try{ if(Math.abs(el.currentTime-clamped)>0.08) el.currentTime=clamped; }catch(e){} }
        }
      });
      ctx.fillStyle='#000'; ctx.fillRect(0,0,exportW,exportH);
      visuals.forEach(clip=>{
        const track=editor.allTracks.find(t=>t.id===clip.trackId); if(track&&track.enabled===false) return;
        const el=editor.layerElements[clip.id]; if(!el) return;
        try{
          const tr=editor.transforms[clip.id]||{x:0,y:0,scale:1,scaleX:1,scaleY:1,rot:0};
          const tx2=tr.x * (exportW/720); const ty2=tr.y * (exportH/405);
          const sx=(tr.scale||1)*(tr.scaleX||1); const sy=(tr.scale||1)*(tr.scaleY||1);
          ctx.save(); ctx.translate(exportW/2+tx2, exportH/2+ty2); ctx.rotate((tr.rot||0)*Math.PI/180); ctx.scale(sx,sy);
          if(el.tagName==='VIDEO' || el.tagName==='IMG'){
            const vw=el.videoWidth||el.naturalWidth||exportW; const vh=el.videoHeight||el.naturalHeight||exportH;
            const canvasAspect=exportW/exportH; const mediaAspect=vw/vh;
            let drawW,drawH;
            if(mediaAspect>canvasAspect){ drawW=exportW; drawH=exportW/mediaAspect; } else { drawH=exportH; drawW=exportH*mediaAspect; }
            ctx.drawImage(el, -drawW/2, -drawH/2, drawW, drawH);
          }
          ctx.restore();
        }catch(e){}
      });
      cov.filter(c=>c.type==='text').forEach(clip=>{
        const st=editor.textStyles[clip.id]; if(!st) return;
        const tr=editor.transforms[clip.id]||{x:0,y:0,scale:1,scaleX:1,scaleY:1,rot:0};
        try{
          ctx.save(); const tx2=tr.x*(exportW/720); const ty2=tr.y*(exportH/405);
          ctx.translate(exportW/2+tx2, exportH/2+ty2); ctx.rotate((tr.rot||0)*Math.PI/180); ctx.scale((tr.scale||1)*(tr.scaleX||1), (tr.scale||1)*(tr.scaleY||1));
          ctx.font=`${st.weight} ${st.size*(exportH/405)}px ${st.font}`; ctx.fillStyle=st.color; ctx.textAlign=st.align; ctx.textBaseline='middle';
          if(parseFloat(st.bgAlpha)>0){
            const m=ctx.measureText(st.text); const bgW=m.width+40; const bgH=st.size*(exportH/405)+20;
            ctx.fillStyle=`rgba(${parseInt(st.bg.slice(1,3),16)},${parseInt(st.bg.slice(3,5),16)},${parseInt(st.bg.slice(5,7),16)},${st.bgAlpha})`;
            ctx.fillRect(-bgW/2,-bgH/2,bgW,bgH); ctx.fillStyle=st.color;
          }
          ctx.fillText(st.text,0,0); ctx.restore();
        }catch(e){}
      });
      // FIX KEY: manual frame push
      try{ if(videoTrack && videoTrack.requestFrame) videoTrack.requestFrame(); }catch(e){}
      exportedTime+=1/30;
      progress.style.width=Math.min(95,(exportedTime/totalDuration)*100)+'%';
      status.textContent=`Exportando ${exportedTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s - ${exportW}x${exportH} ${mime.includes('mp4')?'MP4':'WEBM'} - 1x velocidad real`;
      setTimeout(exportLoop, 5);
    };
    exportLoop();
  }catch(err){ status.textContent='Error: '+err.message; console.error(err); }
 }
}
