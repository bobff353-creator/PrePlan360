(function(){
 const params=new URLSearchParams(location.search);
 if(params.get("view")!=="readonly")return;
 document.body.classList.add("view-only-demo");
 const ownerIndex=typeof MODULES!=="undefined"?MODULES.findIndex(function(module){return module.id==="owner";}):-1;
 if(ownerIndex>=0)MODULES.splice(ownerIndex,1);
 if(typeof current!=="undefined"&&current==="owner")current="board";
 if(typeof buildNav==="function")buildNav();
 if(typeof render==="function")render();
 const lockedWords=/^(?:\+\s*)?(?:add|save|edit|build|create|delete|remove|submit|approve|duplicate|publish|record|assign|award|new template|tone out|clear incident|simulate|use gps|resolve|reset|mark reviewed|complete|send|prepare alert|start quick)/i;
 const lockedHandlers=/(toggleTone|ics(?:Set|Add|Declare|Stamp)|rspCycle|rspResolveLocation|rspUseDeviceGps|rspCreateQuickPreplan|hydRecord|hydAdd|ddAdd|ddToggle|invSave|invAdjust|rstSave|rstDelete|rstQuick|rstAlertFlag|rstRecordAlert|rstReviewAlert|schxSave|schxAssign|schxUnassign|schxFillHome|schxSubmit|schxApprove|schxDelete|ownerAdd|ownerDuplicate|ownerSave|ownerMove|ppNew|ppSave|ppEdit|ppPublish|ppMetaSet)/i;
 function lock(){
  document.querySelectorAll("input,textarea,select").forEach(function(el){el.disabled=true;el.setAttribute("aria-disabled","true");el.title="View-only demo: editing is locked";});
  document.querySelectorAll("[draggable]").forEach(function(el){el.draggable=false;});
 document.querySelectorAll("button").forEach(function(btn){
   const label=(btn.textContent||"").trim(),handler=btn.getAttribute("onclick")||"";
   if(lockedWords.test(label)||lockedHandlers.test(handler)){btn.disabled=true;btn.classList.add("view-only-locked");btn.setAttribute("aria-disabled","true");btn.title="View-only demo: this action is locked";}
  });
  document.querySelectorAll("[onclick]:not(button)").forEach(function(el){const handler=el.getAttribute("onclick")||"";if(lockedHandlers.test(handler)){el.removeAttribute("onclick");el.classList.add("view-only-locked");el.setAttribute("aria-disabled","true");el.title="View-only demo: this action is locked";}});
 }
 const badge=document.createElement("div");badge.className="view-only-badge";badge.setAttribute("role","status");badge.innerHTML="<i></i> View-only fictional demo";document.body.appendChild(badge);
 let queued=false;const observer=new MutationObserver(function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;lock();});});
 observer.observe(document.getElementById("main")||document.body,{childList:true,subtree:true});
 lock();
 const toneButton=document.getElementById("toneBtn");
 if(toneButton){toneButton.disabled=true;toneButton.title="A fictional demonstration call will arrive after 30 seconds";}
 window.setTimeout(function(){
  if(toneOn)return;
  const alert=document.createElement("div");alert.className="demo-dispatch-alert";alert.setAttribute("role","alert");alert.innerHTML="<span>FICTIONAL INCOMING CALL</span><b>Structure Fire · 1200 Ember Ridge Blvd</b><small>Opening Respond Intelligence</small>";document.body.appendChild(alert);
  if(typeof toggleTone==="function")toggleTone();
  if(typeof dlRecordDemoDispatch==="function")dlRecordDemoDispatch();
  window.setTimeout(function(){alert.classList.add("leaving");window.setTimeout(function(){alert.remove();},500);},5000);
 },30000);
})();
