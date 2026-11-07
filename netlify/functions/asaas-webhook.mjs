import {createClient} from "@supabase/supabase-js";
export default async (req)=>{
 if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
 const env=process.env,secret=env.ASAAS_WEBHOOK_TOKEN;
 if(!secret||req.headers.get("asaas-access-token")!==secret)return new Response("Unauthorized",{status:401});
 try{
  const body=await req.json();
  const accepted=["PAYMENT_RECEIVED","PAYMENT_CONFIRMED"];
  if(accepted.includes(body.event)&&body.payment?.externalReference){
   const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
   await sb.from("orders").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",body.payment.externalReference).eq("asaas_payment_id",body.payment.id);
  }
  if(["PAYMENT_OVERDUE","PAYMENT_DELETED","PAYMENT_REFUNDED"].includes(body.event)&&body.payment?.externalReference){
   const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
   await sb.from("orders").update({status:"cancelled"}).eq("id",body.payment.externalReference).eq("asaas_payment_id",body.payment.id);
  }
  return new Response("OK",{status:200});
 }catch{return new Response("Webhook error",{status:500})}
};
