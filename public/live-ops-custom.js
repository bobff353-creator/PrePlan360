const BOARD_STORAGE_KEY="fireflow360.liveBoard.v3";
const BOARD_PANEL_LABELS={equipment:"Equipment Issues",duty:"Current Daily Duty",closecalls:"Firefighter Close Calls",lodd:"U.S. Firefighter LODD",training:"Upcoming Training",weather:"Weather",alerts:"Weather Alerts",radar:"Weather Radar"};
const BOARD_DEFAULTS={department:"Redstone Valley Fire & Rescue",title:"Live Operations Board",order:["summary","station","apparatus"],visible:{summary:true,station:true,apparatus:true},widths:{summary:"full",station:"half",apparatus:"half"},panels:["equipment","duty","closecalls","training"],rotationSec:8,responseSec:45,forecastDetail:"3",weatherUrl:"",alertsUrl:"",radarUrl:"",radarRefreshMin:10,external:[]};
let boardSettingsOpen=false,boardDragId="",responseReturnTimer=null,lastRadarRefresh=0;
function cloneBoardDefaults(){return JSON.parse(JSON.stringify(BOARD_DEFAULTS));}
function safeText(v){return String(v==null?"":v).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
function validHttpUrl(v){try{const u=new URL(String(v||"").trim());return (u.protocol==="http:"||u.protocol==="https:")?u.toString():"";}catch(e){return "";}}
function normalizeBoardCfg(raw){
 const c=Object.assign(cloneBoardDefaults(),raw||{});
 c.visible=Object.assign({},BOARD_DEFAULTS.visible,(raw&&raw.visible)||{});
 c.widths=Object.assign({},BOARD_DEFAULTS.widths,(raw&&raw.widths)||{});
 c.external=Array.isArray(c.external)?c.external.map(function(s){return {id:String(s.id||("ext-"+Date.now()+"-"+Math.random().toString(36).slice(2,7))),title:String(s.title||"External display").slice(0,80),url:validHttpUrl(s.url)};}).filter(function(s){return s.url;}):[];
 const known=["summary","station","apparatus"].concat(c.external.map(function(s){return s.id;}));
 c.order=Array.isArray(c.order)?c.order.filter(function(id,i,a){return known.indexOf(id)>=0&&a.indexOf(id)===i;}):[];
 known.forEach(function(id){if(c.order.indexOf(id)<0)c.order.push(id);if(c.visible[id]===undefined)c.visible[id]=true;if(!c.widths[id])c.widths[id]=id==="summary"?"full":"half";});
 c.panels=Array.isArray(c.panels)?c.panels.filter(function(k,i,a){return BOARD_PANEL_LABELS[k]&&a.indexOf(k)===i;}):BOARD_DEFAULTS.panels.slice();
 if(!c.panels.length)c.panels=["equipment"];
 c.rotationSec=Math.max(5,Math.min(300,Number(c.rotationSec)||8));
 c.responseSec=Math.max(5,Math.min(600,Number(c.responseSec)||45));
 c.radarRefreshMin=Math.max(1,Math.min(120,Number(c.radarRefreshMin)||10));
 c.forecastDetail=["current","3","7"].indexOf(String(c.forecastDetail))>=0?String(c.forecastDetail):"3";
 c.weatherUrl=validHttpUrl(c.weatherUrl);c.alertsUrl=validHttpUrl(c.alertsUrl);c.radarUrl=validHttpUrl(c.radarUrl);
 c.department=String(c.department||BOARD_DEFAULTS.department).slice(0,80);c.title=String(c.title||BOARD_DEFAULTS.title).slice(0,80);
 return c;
}
function loadBoardCfg(){try{return normalizeBoardCfg(JSON.parse(localStorage.getItem(BOARD_STORAGE_KEY)||"null"));}catch(e){return cloneBoardDefaults();}}
let boardCfg=loadBoardCfg();
function saveBoardCfg(){localStorage.setItem(BOARD_STORAGE_KEY,JSON.stringify(boardCfg));}
function boardDefs(){return [{id:"summary",label:"Staffing and incident summary"},{id:"station",label:"Rotating station information"},{id:"apparatus",label:"Apparatus status"}].concat(boardCfg.external.map(function(s){return {id:s.id,label:s.title};}));}
function openBoardSettings(){boardSettingsOpen=true;render();}
function closeBoardSettings(){boardSettingsOpen=false;render();}
function moveBoardWidget(id,dir){const a=boardCfg.order.slice(),i=a.indexOf(id),j=i+dir;if(i<0||j<0||j>=a.length)return;const t=a[i];a[i]=a[j];a[j]=t;boardCfg.order=a;saveBoardCfg();render();}
function boardDragStart(ev,id){boardDragId=id;ev.currentTarget.classList.add("dragging");ev.dataTransfer.effectAllowed="move";ev.dataTransfer.setData("text/plain",id);}
function boardDragOver(ev){ev.preventDefault();ev.currentTarget.classList.add("dragover");ev.dataTransfer.dropEffect="move";}
function boardDragLeave(ev){ev.currentTarget.classList.remove("dragover");}
function boardDrop(ev,target){ev.preventDefault();ev.currentTarget.classList.remove("dragover");const source=boardDragId||ev.dataTransfer.getData("text/plain");if(!source||source===target)return;const a=boardCfg.order.filter(function(id){return id!==source;}),at=a.indexOf(target);a.splice(at<0?a.length:at,0,source);boardCfg.order=a;saveBoardCfg();render();}
function boardDragEnd(ev){ev.currentTarget.classList.remove("dragging");document.querySelectorAll(".board-widget").forEach(function(x){x.classList.remove("dragover");});boardDragId="";}
function sourceFrame(url,label,height,refresh){
 if(!url)return '<div class="board-empty"><b>'+safeText(label)+' source not configured</b><div style="margin-top:6px">Open Board settings and paste a complete HTTPS display link.</div></div>';
 let src=url;if(refresh){try{const u=new URL(url);u.searchParams.set("fireflow_refresh",String(Date.now()));src=u.toString();}catch(e){}}
 return '<div class="embed-shell"><iframe src="'+safeText(src)+'" title="'+safeText(label)+'" style="min-height:'+height+'px" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-forms allow-popups allow-scripts allow-same-origin"></iframe><div class="embed-tools"><span class="muted" style="font-size:11px;flex:1">If the source blocks embedding, use Open source.</span><a class="btn" target="_blank" rel="noopener noreferrer" href="'+safeText(url)+'">Open source</a></div></div>';
}
function widgetShell(id,body){const w=boardCfg.widths[id]||"half";return '<section class="board-widget w-'+safeText(w)+'" draggable="true" data-widget="'+safeText(id)+'" ondragstart="boardDragStart(event,\''+safeText(id)+'\')" ondragover="boardDragOver(event)" ondragleave="boardDragLeave(event)" ondrop="boardDrop(event,\''+safeText(id)+'\')" ondragend="boardDragEnd(event)"><div class="widget-grip" title="Drag to move"><span>Move</span><b>::</b></div>'+body+'</section>';}
function renderBoardSummary(){
 const staffOk=true,oic="Chief A. Morgan";
 return '<div class="bsummary"><div class="btile '+(staffOk?"":"warn")+'"><span>Staffing</span><strong>7 / 7</strong><small>'+(staffOk?"Complete - minimum met":"Coverage needs attention")+'</small></div><div class="btile"><span>Officer in Charge</span><strong>'+safeText(oic)+'</strong><small>Current shift command - B</small></div><div class="btile '+(toneOn?"fire":"")+'"><span>Active Call</span>'+(toneOn?'<strong>Structure Fire</strong><b>1200 Ember Ridge Blvd</b><small>E-1204 - T-1211 - M-1231 - 11:42</small>':'<strong>None</strong><small>No open calls</small>')+'</div><div class="btile warn"><span>Next Shift Change</span><strong>Shift A - 0700</strong><small>In 14h 12m</small></div></div>';
}
function renderStationWidget(){return '<div class="card rotpanel"><h3 id="rotTitle">Station Information</h3><div id="rotBody"></div><div class="rotdots" id="rotDots"></div></div>';}
function renderApparatusWidget(){
 return '<div class="card"><h3>Apparatus Status - Fleet + CAD</h3><div class="appstrip">'+APPARATUS.map(function(a){const cls=a.status==="Out of Service"?"oos":(toneOn&&a.u!=="E-1206")?"committed":"";return '<div class="appchip '+cls+'"><b>'+safeText(a.u)+'</b><span>'+(cls==="committed"?"On call":safeText(a.status))+'</span></div>';}).join("")+'</div><p class="muted" style="font-size:12px;margin:14px 0 0">Committed units show in red during an active incident. Demo fleet status is not connected to live CAD.</p><div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn '+(toneOn?"":"pri")+'" onclick="toggleTone()">'+(toneOn?"Clear Incident":"Simulate Dispatch")+'</button><button class="btn" onclick="cycleRot()">Advance panel</button></div></div>';
}
function renderExternalWidget(id){const s=boardCfg.external.find(function(x){return x.id===id;});return s?'<div class="card"><h3>'+safeText(s.title)+'</h3>'+sourceFrame(s.url,s.title,340,false)+'</div>':"";}
function renderBoardWidget(id){if(id==="summary")return widgetShell(id,renderBoardSummary());if(id==="station")return widgetShell(id,renderStationWidget());if(id==="apparatus")return widgetShell(id,renderApparatusWidget());return widgetShell(id,renderExternalWidget(id));}
function activeBoardPanels(){return boardCfg.panels.length?boardCfg.panels:["equipment"];}
function forecastHeight(){return boardCfg.forecastDetail==="current"?240:boardCfg.forecastDetail==="7"?560:390;}
paintRot=function(forceRefresh){
 const panels=activeBoardPanels();if(rotIdx>=panels.length)rotIdx=0;
 const key=panels[rotIdx],title=document.getElementById("rotTitle"),body=document.getElementById("rotBody"),dots=document.getElementById("rotDots");if(!title||!body||!dots)return;
 title.textContent=BOARD_PANEL_LABELS[key]||"Station Information";
 if(key==="equipment")body.innerHTML=EQUIP.map(function(e){return '<div class="newsitem"><strong>'+safeText(e.item)+' - <span style="color:var(--warn)">'+safeText(e.status)+'</span></strong><span class="muted" style="font-size:12px">'+safeText(e.detail)+'</span></div>';}).join("");
 else if(key==="duty")body.innerHTML='<div class="result" style="text-align:left"><span class="pill p-fire">NOW - Afternoon</span><div style="font-size:18px;font-weight:800;margin-top:8px">Hydrant flow testing - Zone 4 East</div><div class="muted">5 hydrants due this cycle - record static/residual in Hydrants module</div></div>';
 else if(key==="closecalls")body.innerHTML=CLOSECALLS.map(function(c){return '<div class="newsitem"><time>'+safeText(c.date)+'</time><strong>'+safeText(c.title)+'</strong></div>';}).join("");
 else if(key==="lodd")body.innerHTML='<div class="board-empty"><b>Connect an official LODD source</b><div style="margin-top:6px">This board does not display an unverified live total.</div></div>';
 else if(key==="training")body.innerHTML=TRAINING.map(function(t){return '<div class="newsitem"><strong>'+safeText(t.course)+'</strong><span class="muted" style="font-size:12px">'+safeText(t.prov)+' - '+safeText(t.dates)+'</span></div>';}).join("");
 else if(key==="weather")body.innerHTML='<div class="muted" style="font-size:11px;margin-bottom:8px">Forecast detail: '+safeText(boardCfg.forecastDetail==="current"?"current conditions":boardCfg.forecastDetail+" day")+'</div>'+sourceFrame(boardCfg.weatherUrl,"Weather",forecastHeight(),!!forceRefresh);
 else if(key==="alerts")body.innerHTML='<div class="weather-alert"><b>Weather alert panel enabled</b><div class="muted" style="font-size:11px;margin-top:3px">Alerts shown here come from your configured source; PrePlan 360 does not independently verify or send them.</div></div>'+sourceFrame(boardCfg.alertsUrl,"Weather alerts",320,!!forceRefresh);
 else if(key==="radar"){body.innerHTML=sourceFrame(boardCfg.radarUrl,"Weather radar",470,true);lastRadarRefresh=Date.now();}
 dots.innerHTML=panels.map(function(k,i){return '<button class="'+(i===rotIdx?"active":"")+'" onclick="setRot('+i+')" aria-label="Show '+safeText(BOARD_PANEL_LABELS[k])+'"></button>';}).join("")+'<span>Rotates every '+boardCfg.rotationSec+' seconds</span>';
};
cycleRot=function(){const p=activeBoardPanels();rotIdx=(rotIdx+1)%p.length;nextBoardRotateAt=Date.now()+boardCfg.rotationSec*1000;paintRot(false);};
setRot=function(i){rotIdx=i;nextBoardRotateAt=Date.now()+boardCfg.rotationSec*1000;paintRot(false);};
function saveBoardSettings(){
 boardCfg.department=document.getElementById("bc_department").value.trim()||BOARD_DEFAULTS.department;boardCfg.title=document.getElementById("bc_title").value.trim()||BOARD_DEFAULTS.title;
 boardCfg.rotationSec=document.getElementById("bc_rotation").value;boardCfg.responseSec=document.getElementById("bc_response").value;boardCfg.radarRefreshMin=document.getElementById("bc_radar_refresh").value;boardCfg.forecastDetail=document.getElementById("bc_forecast").value;
 boardCfg.weatherUrl=document.getElementById("bc_weather_url").value;boardCfg.alertsUrl=document.getElementById("bc_alerts_url").value;boardCfg.radarUrl=document.getElementById("bc_radar_url").value;
 boardCfg.panels=Array.from(document.querySelectorAll("[data-board-panel]:checked")).map(function(x){return x.value;});
 boardDefs().forEach(function(d){const vis=document.querySelector('[data-widget-visible="'+d.id+'"]'),wid=document.querySelector('[data-widget-width="'+d.id+'"]');boardCfg.visible[d.id]=!!(vis&&vis.checked);if(wid)boardCfg.widths[d.id]=wid.value;});
 boardCfg=normalizeBoardCfg(boardCfg);saveBoardCfg();boardSettingsOpen=false;nextBoardRotateAt=Date.now()+boardCfg.rotationSec*1000;lastRadarRefresh=0;render();
}
function addExternalSource(){const title=document.getElementById("bc_ext_title").value.trim()||"External display",url=validHttpUrl(document.getElementById("bc_ext_url").value);if(!url){alert("Enter a complete http or https link.");return;}const id="ext-"+Date.now().toString(36);boardCfg.external.push({id:id,title:title.slice(0,80),url:url});boardCfg.order.push(id);boardCfg.visible[id]=true;boardCfg.widths[id]="half";saveBoardCfg();render();}
function removeExternalSource(id){boardCfg.external=boardCfg.external.filter(function(s){return s.id!==id;});boardCfg.order=boardCfg.order.filter(function(x){return x!==id;});delete boardCfg.visible[id];delete boardCfg.widths[id];saveBoardCfg();render();}
function resetBoardSettings(){if(!confirm("Reset this display to the default Live Ops layout?"))return;localStorage.removeItem(BOARD_STORAGE_KEY);boardCfg=cloneBoardDefaults();boardSettingsOpen=false;rotIdx=0;render();}
function boardConfigMarkup(){
 const panelChecks=Object.keys(BOARD_PANEL_LABELS).map(function(k){return '<label class="checkrow"><input type="checkbox" data-board-panel value="'+k+'" '+(boardCfg.panels.indexOf(k)>=0?"checked":"")+'><span>'+safeText(BOARD_PANEL_LABELS[k])+'</span></label>';}).join("");
 const layoutRows=boardCfg.order.map(function(id){const d=boardDefs().find(function(x){return x.id===id;});if(!d)return "";const width=boardCfg.widths[id]||"half";return '<div class="layout-row"><label class="checkrow" style="padding:7px 9px"><input type="checkbox" data-widget-visible="'+safeText(id)+'" '+(boardCfg.visible[id]!==false?"checked":"")+'><span>'+safeText(d.label)+'</span></label><select data-widget-width="'+safeText(id)+'"><option value="third" '+(width==="third"?"selected":"")+'>One third</option><option value="half" '+(width==="half"?"selected":"")+'>Half</option><option value="full" '+(width==="full"?"selected":"")+'>Full</option></select><button class="btn" onclick="moveBoardWidget(\''+safeText(id)+'\',-1)">Up</button><button class="btn" onclick="moveBoardWidget(\''+safeText(id)+'\',1)">Down</button></div>';}).join("");
 const sources=boardCfg.external.length?boardCfg.external.map(function(s){return '<div class="source-item"><span><b>'+safeText(s.title)+'</b><small>'+safeText(s.url)+'</small></span><button class="btn" onclick="removeExternalSource(\''+safeText(s.id)+'\')">Remove</button></div>';}).join(""):'<div class="muted" style="font-size:12px">No external display links added yet.</div>';
 return '<div class="config-backdrop" role="dialog" aria-modal="true" aria-label="Live Ops Board settings" onclick="if(event.target===this)closeBoardSettings()"><div class="config-panel"><div class="config-head"><div><div class="eyebrow">This display</div><h2>Live Ops Board settings</h2></div><button class="btn" onclick="closeBoardSettings()">Close</button></div><div class="config-body"><div class="config-grid">'+
 '<section class="config-section"><h3>Board identity and timing</h3><div class="field"><label for="bc_department">Department or station</label><input id="bc_department" value="'+safeText(boardCfg.department)+'"></div><div class="field"><label for="bc_title">Board title</label><input id="bc_title" value="'+safeText(boardCfg.title)+'"></div><div class="field"><label for="bc_rotation">Station info rotation (seconds)</label><input id="bc_rotation" type="number" min="5" max="300" value="'+boardCfg.rotationSec+'"></div><div class="field"><label for="bc_response">Response page display time (seconds)</label><input id="bc_response" type="number" min="5" max="600" value="'+boardCfg.responseSec+'"></div></section>'+
 '<section class="config-section"><h3>Station information rotation</h3><div class="checkgrid">'+panelChecks+'</div><div class="muted" style="font-size:11px;margin-top:10px">Choose exactly what this screen scrolls through. At least one panel remains enabled.</div></section>'+
 '<section class="config-section full"><h3>Weather, alerts, and radar sources</h3><div class="config-grid"><div><div class="field"><label for="bc_forecast">Weather amount</label><select id="bc_forecast"><option value="current" '+(boardCfg.forecastDetail==="current"?"selected":"")+'>Current conditions</option><option value="3" '+(boardCfg.forecastDetail==="3"?"selected":"")+'>3-day view</option><option value="7" '+(boardCfg.forecastDetail==="7"?"selected":"")+'>7-day view</option></select></div><div class="field"><label for="bc_radar_refresh">Radar refresh every (minutes)</label><input id="bc_radar_refresh" type="number" min="1" max="120" value="'+boardCfg.radarRefreshMin+'"></div></div><div><div class="field"><label for="bc_weather_url">Weather display link</label><input id="bc_weather_url" type="url" placeholder="https://..." value="'+safeText(boardCfg.weatherUrl)+'"></div><div class="field"><label for="bc_alerts_url">Weather alert link</label><input id="bc_alerts_url" type="url" placeholder="https://..." value="'+safeText(boardCfg.alertsUrl)+'"></div><div class="field"><label for="bc_radar_url">Weather radar link</label><input id="bc_radar_url" type="url" placeholder="https://..." value="'+safeText(boardCfg.radarUrl)+'"></div></div></div></section>'+
 '<section class="config-section full"><h3>Board layout</h3><div class="muted" style="font-size:11px;margin-bottom:6px">Drag cards directly on the board, or use these controls for touch and keyboard displays.</div>'+layoutRows+'</section>'+
 '<section class="config-section full"><h3>External display links</h3>'+sources+'<div class="source-row"><div class="field"><label for="bc_ext_title">Display name</label><input id="bc_ext_title" placeholder="Traffic camera"></div><div class="field"><label for="bc_ext_url">HTTPS display link</label><input id="bc_ext_url" type="url" placeholder="https://..."></div><button class="btn pri" onclick="addExternalSource()">Add display</button></div><div class="muted" style="font-size:11px;margin-top:10px">Some providers block embedded views. Their Open source button still works.</div></section>'+
 '</div><div class="config-actions"><button class="btn" onclick="resetBoardSettings()">Reset this display</button><button class="btn pri" onclick="saveBoardSettings()">Save board</button></div><div class="footer-note" style="margin-top:14px">Settings are saved on this browser display only. No links or credentials are sent to PrePlan 360.</div></div></div></div>';
}
viewBoard=function(){
 const canvas=boardCfg.order.filter(function(id){return boardCfg.visible[id]!==false;}).map(renderBoardWidget).join("");
 return '<div class="boardhead"><div class="title"><p>'+safeText(boardCfg.department)+'</p><h1>'+safeText(boardCfg.title)+'</h1></div><div class="boardhead-actions"><button class="btn" onclick="openBoardSettings()">Customize board</button><div class="bclock"><strong id="bclk">--:--:--</strong><span id="bdate"></span><small><i></i> This display - settings saved</small></div></div></div><div class="boardcanvas">'+(canvas||'<div class="board-empty" style="grid-column:1/-1"><b>No board cards are visible.</b><div style="margin-top:8px"><button class="btn pri" onclick="openBoardSettings()">Open settings</button></div></div>')+'</div><div class="footer-note">Drag cards to arrange this Live Ops display. Choose its station-information rotation, weather and radar sources, radar refresh timing, response-screen duration, and outside display links. Demo records are not connected to live CAD.</div>'+(boardSettingsOpen?boardConfigMarkup():"");
};
const originalToggleTone=toggleTone;
toggleTone=function(){
 const wasBoard=current==="board",turningOn=!toneOn;
 if(responseReturnTimer){clearTimeout(responseReturnTimer);responseReturnTimer=null;}
 originalToggleTone();
 if(turningOn&&wasBoard){current="respond";buildNav();render();responseReturnTimer=setTimeout(function(){if(toneOn){current="board";buildNav();render();}},boardCfg.responseSec*1000);}
};
setInterval(function(){if(current==="board"){const panels=activeBoardPanels(),key=panels[rotIdx];if(key==="radar"&&boardCfg.radarUrl&&Date.now()-lastRadarRefresh>=boardCfg.radarRefreshMin*60000)paintRot(true);}},1000);
nextBoardRotateAt=Date.now()+boardCfg.rotationSec*1000;
if(current==="board")render();
