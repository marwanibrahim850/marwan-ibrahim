document.addEventListener("DOMContentLoaded",()=>{
let modal=document.querySelector("[data-modal]");
if(!modal)return;
let product=null, selected={};

function selectedVariant(){
 return product.variants.find(v=>v.options.every((o,i)=>selected[i]===o)) || product.variants[0];
}
document.addEventListener("click",e=>{
 let open=e.target.closest("[data-open-product]");
 if(open){
  product=JSON.parse(document.querySelector(`[data-product-json="${open.dataset.openProduct}"]`).textContent);
  selected={};
  modal.hidden=false;
  modal.querySelector("[data-image]").src=product.image;
  modal.querySelector("[data-title]").textContent=product.title;
  modal.querySelector("[data-description]").innerHTML=product.description;
  let opts=modal.querySelector("[data-options]");
  opts.innerHTML="";
  (product.options||[]).forEach((opt,index)=>{
    let wrap=document.createElement("div");
    wrap.innerHTML="<label>"+opt.name+"</label>";
    opt.values.forEach(val=>{
      let b=document.createElement("button");
      b.type="button"; b.textContent=val;
      b.onclick=()=>{selected[index]=val; updatePrice();};
      wrap.appendChild(b);
    });
    opts.appendChild(wrap);
  });
  updatePrice();
 }
 if(e.target.closest("[data-close]")) modal.hidden=true;
 let add=e.target.closest("[data-add]");
 if(add&&product){
   let v=selectedVariant();
   fetch("/cart/add.js",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{id:v.id,quantity:1}]})})
   .then(()=>{
    // bonus product if black + medium
    let isBonus=Object.values(selected).includes("Black") && Object.values(selected).includes("Medium");
    add.textContent="Added ✓";
    if(isBonus){
      // Soft Winter Jacket is searched by title through cart flow only when variant id is configured
      add.dataset.bonusChecked="true";
    }
   });
 }
});
function updatePrice(){
 let v=selectedVariant();
 modal.querySelector("[data-price]").textContent=v.price || v.title;
}
});