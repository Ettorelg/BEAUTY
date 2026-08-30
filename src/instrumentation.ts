export async function register(){
  if(process.env.NEXT_RUNTIME==="nodejs"&&process.env.DATABASE_URL){
    const {ensureFidelitySchema}=await import("@/lib/ensure-fidelity-schema");
    await ensureFidelitySchema();
    const {startAppointmentReminderWorker}=await import("@/lib/appointment-reminders");
    startAppointmentReminderWorker();
  }
}
