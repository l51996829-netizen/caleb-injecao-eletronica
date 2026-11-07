import {createClient} from "@supabase/supabase-js";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export default async (req)=>{
 if(req.method!=="GET")return json({error:"Método não permitido"},405);
 const u=new URL(req.url),id=u.searchParams.get("orderId"),token=u.searchParams.get("token");
 if(!id||!token)return json({error:"Pedido não encontrado."},400);
 const env=process.env;
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:"Servidor não configurado."},503);
 const sb=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
 const {data,error}=await sb.from("orders").select("status").eq("id",id).eq("order_access_token",token).maybeSingle();
 if(error||!data)return json({error:"Pedido não encontrado."},404);
 return json({status:data.status});
};
