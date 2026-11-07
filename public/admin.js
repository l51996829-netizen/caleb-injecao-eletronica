import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const c=window.CALEB_CONFIG||{},sb=(c.SUPABASE_URL&&c.SUPABASE_ANON_KEY)?createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY):null,$=id=>document.getElementById(id);
const money=n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let user=null;
async function init(){if(!sb){$("loginMsg").textContent="Configure o Supabase em config.js e tente novamente.";return}const {data}=await sb.auth.getSession();if(data.session){user=data.session.user;show()} }
function show(){$("login").classList.add("hidden");$("app").classList.remove("hidden");load()}
$("loginForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),{data,error}=await sb.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){$("loginMsg").textContent="E-mail ou senha inválidos.";return}user=data.user;show()};
$("logout").onclick=async()=>{await sb.auth.signOut();location.reload()};
$("productForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const row={name:f.get("name"),price:Number(f.get("price")),stock:Number(f.get("stock")),image_url:f.get("image_url")||null,description:f.get("description"),active:true};const {error}=await sb.from("products").insert(row);if(error){alert("Erro ao cadastrar: "+error.message);return}e.currentTarget.reset();loadProducts()};
async function load(){loadProducts();loadOrders()}
async function loadProducts(){const {data,error}=await sb.from("products").select("*").order("created_at",{ascending:false});if(error)return;$("products").innerHTML=(data||[]).map(p=>`<div class="admin-row"><div><b>${p.name}</b><small>${money(p.price)} • Estoque: ${p.stock} • ${p.active?"Ativo":"Oculto"}</small></div><button data-edit="${p.id}" class="btn">Editar</button><button data-toggle="${p.id}" class="btn">${p.active?"Ocultar":"Ativar"}</button><button data-del="${p.id}" class="danger">Excluir</button></div>`).join("")||'<p class="muted">Nenhum produto cadastrado.</p>';
document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=async()=>{
 const p=data.find(x=>x.id===b.dataset.edit);if(!p)return;
 const name=prompt("Nome do produto:",p.name);if(name===null)return;
 const price=prompt("Preço em reais:",p.price);if(price===null)return;
 const stock=prompt("Quantidade em estoque:",p.stock);if(stock===null)return;
 const image_url=prompt("URL pública da imagem (deixe vazio para remover):",p.image_url||"");if(image_url===null)return;
 const description=prompt("Descrição:",p.description||"");if(description===null)return;
 const nprice=Number(price),nstock=Number(stock);
 if(!name.trim()||!Number.isFinite(nprice)||nprice<=0||!Number.isInteger(nstock)||nstock<0){alert("Confira nome, preço e estoque.");return}
 const {error}=await sb.from("products").update({name:name.trim(),price:nprice,stock:nstock,image_url:image_url.trim()||null,description}).eq("id",p.id);
 if(error)alert("Não foi possível salvar: "+error.message);loadProducts();
});
document.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=async()=>{const p=data.find(x=>x.id===b.dataset.toggle);await sb.from("products").update({active:!p.active}).eq("id",p.id);loadProducts()});
document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("Excluir este produto?")){await sb.from("products").delete().eq("id",b.dataset.del);loadProducts()}})}
async function loadOrders(){const {data,error}=await sb.from("orders").select("id,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(50);if(error){$("orders").textContent=error.message;return}$("orders").innerHTML=(data||[]).map(o=>`<div class="admin-row"><div><b>Pedido ${o.id.slice(0,8)}</b><small>${o.customer_name} • ${money(o.total)} • ${new Date(o.created_at).toLocaleString("pt-BR")}</small></div><b class="${o.status==="paid"?"status":"muted"}">${o.status==="paid"?"PAGO":o.status==="pending"?"AGUARDANDO":"CANCELADO"}</b></div>`).join("")||'<p class="muted">Nenhum pedido ainda.</p>'}
init();
