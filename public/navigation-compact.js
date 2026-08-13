(function(){
  const KEY="fireflow360.navigation.width.v1",body=document.body,brand=document.querySelector(".brand");
  if(!brand)return;
  const button=document.createElement("button");
  button.type="button";
  button.className="desktop-nav-toggle";
  function apply(compact){
    body.classList.toggle("nav-compact",compact);
    button.textContent=compact?"›":"‹";
    button.setAttribute("aria-expanded",String(!compact));
    button.setAttribute("aria-label",compact?"Expand navigation":"Collapse navigation");
    button.title=compact?"Expand navigation":"Collapse navigation";
  }
  let compact=true;
  try{compact=localStorage.getItem(KEY)!=="expanded";}catch(e){}
  apply(compact);
  button.addEventListener("click",function(){compact=!body.classList.contains("nav-compact");apply(compact);try{localStorage.setItem(KEY,compact?"compact":"expanded");}catch(e){}});
  brand.appendChild(button);
})();
