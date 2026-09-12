import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push-notifications";

export async function POST(){const session=await auth.api.getSession({headers:await headers()});if(!session)return NextResponse.json({error:"Accedi prima di provare le notifiche."},{status:401});if(!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return NextResponse.json({error:"Chiavi VAPID non configurate su Railway."},{status:503});try{const sent=await sendPushToUser({userId:session.user.id,title:"Alpha Prenota",body:"Le notifiche funzionano su questo dispositivo.",url:"/account"});return NextResponse.json(sent?{ok:true}:{error:"Nessun dispositivo registrato o invio non riuscito."},{status:sent?200:502});}catch(error){console.error("Push test failed",error);return NextResponse.json({error:"Invio di prova non riuscito. Controlla i log del servizio."},{status:500});}}
