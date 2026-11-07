import { createClient } from "@supabase/supabase-js";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
export default async (req)=>{
 if(req.method!=="POST")return json({error:"Método não permitido"},405);
 const env=process.env;
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.ASAAS_API_KEY)return json({error:"Integração ainda não configurada. Complete as variáveis de ambiente no Netlify."},503);
 try{
  const {customer,items}=await req.json();
  if(!customer?.name||!customer?.email||!Array.isArray(items)||!items.length) return json({error:"Dados do pedido incompletos."},400);
  const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
  const ids=items.map(i=>i.id);
  const {data:products,error:pe}=await sb.from("products").select("id,name,price,stock,active").in("id",ids);
  if(pe)throw pe;
  const lines=items.map(i=>{const p=products.find(x=>x.id===i.id);const qty=Number(i.qty);if(!p||!p.active||!Number.isInteger(qty)||qty<1||qty>p.stock)throw new Error("Produto indisponível ou estoque insuficiente.");return {product_id:p.id,name:p.name,price:Number(p.price),quantity:qty}});
  const total=lines.reduce((s,x)=>s+x.price*x.quantity,0);
  const statusToken=crypto.randomUUID()+crypto.randomUUID();
  const {data:order,error:oe}=await sb.from("orders").insert({customer_name:customer.name,email:customer.email,phone:customer.phone||"",address:customer.address||"",items:lines,total,status:"pending",order_access_token:statusToken}).select("id").single();
  if(oe)throw oe;
  const base=env.ASAAS_ENV==="production"?"https://api.asaas.com/v3":"https://api-sandbox.asaas.com/v3";
  const headers={"Content-Type":"application/json","access_token":env.ASAAS_API_KEY};
  let c=await fetch(base+"/customers",{method:"POST",headers,body:JSON.stringify({name:customer.name,email:customer.email,phone:customer.phone||undefined,externalReference:order.id})});
  let cd=await c.json();if(!c.ok)throw new Error(cd.errors?.[0]?.description||"Erro ao cadastrar cliente no Asaas.");
  let p=await fetch(base+"/payments",{method:"POST",headers,body:JSON.stringify({customer:cd.id,billingType:"PIX",value:Number(total.toFixed(2)),dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),description:"Pedido Caleb "+order.id.slice(0,8),externalReference:order.id})});
  let pd=await p.json();if(!p.ok)throw new Error(pd.errors?.[0]?.description||"Erro ao criar cobrança Pix.");
  let qr=await fetch(base+"/payments/"+pd.id+"/pixQrCode",{headers});
  let qd=await qr.json();if(!qr.ok)throw new Error("Cobrança criada, mas não foi possível obter o QR Code.");
  await sb.from("orders").update({asaas_payment_id:pd.id}).eq("id",order.id);
  return json({orderId:order.id,statusToken,qrCode:qd});
 }catch(e){return json({error:e.message||"Erro interno ao gerar Pix."},400)}
};
