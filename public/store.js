import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.CALEB_CONFIG||{};
const supabase=(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY)?createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id), money=n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let products=[],cart=JSON.parse(localStorage.getItem("caleb-cart")||"[]"),currentOrder=null;
$("year").textContent=new Date().getFullYear();
function persist(){localStorage.setItem("caleb-cart",JSON.stringify(cart));renderCart()}
async function loadProducts(){
 if(!supabase){$("productGrid").innerHTML='<div class="muted">A loja está em configuração. Conecte o Supabase seguindo o arquivo LEIA-ME.</div>';return}
 const {data,error}=await supabase.from("products").select("*").eq("active",true).order("created_at",{ascending:false});
 if(error){$("productGrid").textContent="Não foi possível carregar os produtos.";return}
 products=data||[];renderProducts();
}
function renderProducts(){
 const q=$("search").value.toLowerCase();
 const list=products.filter(p=>(p.name+" "+(p.description||"")).toLowerCase().includes(q));
 $("productGrid").innerHTML=list.length?list.map(p=>`<article class="product">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="placeholder">CE</div>'}<div class="product-body"><h3>${esc(p.name)}</h3><p>${esc(p.description||"")}</p><div class="price">${money(p.price)}</div><p>${p.stock>0?`${p.stock} disponível(is)`:"Esgotado"}</p><button data-add="${p.id}" ${p.stock<1?"disabled":""}>Adicionar ao carrinho</button></div></article>`).join(""):'<p class="muted">Nenhum produto encontrado.</p>';
 document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>add(b.dataset.add));
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;const line=cart.find(x=>x.id===id);if(line)line.qty=Math.min(line.qty+1,p.stock);else cart.push({id,qty:1});persist();openCart()}
function renderCart(){
 $("cartCount").textContent=cart.reduce((s,x)=>s+x.qty,0);
 $("cartItems").innerHTML=cart.length?cart.map(x=>{const p=products.find(y=>y.id===x.id);return p?`<div class="cart-line"><div><b>${esc(p.name)}</b><small>${money(p.price)} cada</small></div><div class="qty"><button data-minus="${p.id}">−</button>${x.qty}<button data-plus="${p.id}">+</button></div></div>`:""}).join(""):'<p class="muted">Seu carrinho está vazio.</p>';
 const total=cart.reduce((s,x)=>s+(products.find(p=>p.id===x.id)?.price||0)*x.qty,0);$("cartTotal").textContent=money(total);
 document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
}
function changeQty(id,d){const l=cart.find(x=>x.id===id),p=products.find(x=>x.id===id);if(!l||!p)return;l.qty+=d;if(l.qty<1)cart=cart.filter(x=>x.id!==id);else l.qty=Math.min(l.qty,p.stock);persist()}
function openCart(){$("cartDrawer").classList.add("open");$("overlay").classList.add("show")}
function closeCart(){$("cartDrawer").classList.remove("open");$("overlay").classList.remove("show")}
$("cartOpen").onclick=openCart;$("cartClose").onclick=closeCart;$("overlay").onclick=closeCart;$("search").oninput=renderProducts;
$("checkoutForm").onsubmit=async e=>{
 e.preventDefault();if(!cart.length){alert("Adicione produtos ao carrinho.");return}
 if(!supabase){alert("A loja ainda não está conectada ao banco de dados.");return}
 const form=new FormData(e.currentTarget),customer={name:form.get("name"),email:form.get("email"),phone:form.get("phone"),address:form.get("address")};
 $("pixModal").classList.add("show");$("pixContent").innerHTML="<p>Gerando sua cobrança Pix...</p>";closeCart();
 try{
  const resp=await fetch("/api/create-pix",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer,items:cart})});
  const data=await resp.json();if(!resp.ok)throw new Error(data.error||"Não foi possível gerar o Pix.");
  currentOrder=data.orderId;
  $("pixContent").innerHTML=`<img class="qr" alt="QR Code Pix" src="data:image/png;base64,${data.qrCode.encodedImage}"><div class="copy" id="pixPayload">${esc(data.qrCode.payload)}</div><button class="btn full" id="copyPix">Copiar código Pix</button><small>Após pagar, esta tela será atualizada automaticamente.</small>`;
  $("copyPix").onclick=()=>navigator.clipboard.writeText(data.qrCode.payload).then(()=>alert("Código Pix copiado!"));
  watchOrder(data.orderId,data.statusToken);
 }catch(err){$("pixContent").innerHTML=`<p>${esc(err.message)}</p>`}
};
async function watchOrder(id,token){
 const poll=setInterval(async()=>{
  try{
   const r=await fetch("/api/order-status?orderId="+encodeURIComponent(id)+"&token="+encodeURIComponent(token));
   const d=await r.json();
   if(r.ok&&d.status==="paid"){$("paymentStatus").textContent="Pagamento confirmado! Pedido pago.";clearInterval(poll)}
   if(r.ok&&d.status==="cancelled"){$("paymentStatus").textContent="Esta cobrança foi cancelada ou expirou.";clearInterval(poll)}
  }catch{}
 },5000);
}
$("pixClose").onclick=()=>$("pixModal").classList.remove("show");
loadProducts();renderCart();
