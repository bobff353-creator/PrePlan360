(function(){
  const brand=document.querySelector(".brand"),nav=document.getElementById("nav");
  if(!brand||!nav)return;
  const button=document.createElement("button");
  button.className="mobile-menu-btn";
  button.type="button";
  button.setAttribute("aria-label","Open navigation");
  button.setAttribute("aria-expanded","false");
  button.textContent="☰";
  const backdrop=document.createElement("div");
  backdrop.className="mobile-nav-backdrop";
  document.body.appendChild(backdrop);
  brand.appendChild(button);
  function setOpen(open){nav.classList.toggle("mobile-open",open);backdrop.classList.toggle("open",open);button.setAttribute("aria-expanded",String(open));button.setAttribute("aria-label",open?"Close navigation":"Open navigation");button.textContent=open?"×":"☰";}
  button.addEventListener("click",()=>setOpen(!nav.classList.contains("mobile-open")));
  backdrop.addEventListener("click",()=>setOpen(false));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")setOpen(false);});
  const originalGo=window.go;
  if(typeof originalGo==="function")window.go=function(id,source){setOpen(false);return originalGo(id,source);};
  window.addEventListener("resize",()=>{if(innerWidth>820)setOpen(false);});
})();
