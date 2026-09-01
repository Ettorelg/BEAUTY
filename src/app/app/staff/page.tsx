import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { serviceCategories, services, staffAbsences, staffInvitations, staffMembers, staffServices, workingHours } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { isStaffEmailConfigured } from "@/lib/staff-invitations";
import { formatMinutes } from "@/modules/availability/domain/time-slots";
import { AppNav } from "../app-nav";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { AbsenceForm } from "./absence-form";
import { addAbsence, addWorkingHours, assignCategory, assignService, createOwnerStaffProfile, createStaffMember, deleteStaffMember, deleteWorkingHours, inviteStaffMember, removeAssignedService, saveWorkingDay, updateStaffMember, updateWorkingHours } from "./actions";

const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const weekdayValues = [1, 2, 3, 4, 5, 6, 0];

export default async function StaffPage() {
  const context = await requireBusinessContext();
  if (context.role === "STAFF") {
    const [ownProfile] = await db.select({ id: staffMembers.id, name: staffMembers.name }).from(staffMembers)
      .where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.userId, context.user.id), eq(staffMembers.active, true))).limit(1);
    const ownAbsences = ownProfile ? await db.select().from(staffAbsences)
      .where(and(eq(staffAbsences.businessId, context.businessId), eq(staffAbsences.staffId, ownProfile.id))).orderBy(asc(staffAbsences.startsAt)) : [];
    return <main className="dashboard-shell"><AppNav businessName={context.businessName} role={context.role} staffAccess/>
      <div className="page-heading"><div><p className="eyebrow">Disponibilità personale</p><h1>Le mie assenze</h1></div><p className="muted">Registra una fascia in cui non sarai disponibile per le prenotazioni.</p></div>
      {ownProfile ? <section className="management-grid"><article className="panel"><h2>Registra assenza</h2><p className="muted">Operatore: <strong>{ownProfile.name}</strong></p><AbsenceForm action={addAbsence} ownName={ownProfile.name}/></article><article className="panel"><h2>Assenze registrate</h2>{ownAbsences.length ? <div className="data-list">{ownAbsences.map(absence => <div className="data-row" key={absence.id}><div><strong>{absence.startsAt.toLocaleString("it-IT", { timeZone: context.timezone })}</strong><p className="muted">fino al {absence.endsAt.toLocaleString("it-IT", { timeZone: context.timezone })}</p>{absence.reason ? <p>{absence.reason}</p> : null}</div></div>)}</div> : <p className="muted">Nessuna assenza registrata.</p>}</article></section> : <div className="empty-state">Il tuo account non è collegato a un profilo operatore. Chiedi al titolare di completare il collegamento.</div>}
    </main>;
  }
  const staffRows = await db.select({
    id: staffMembers.id,
    businessId: staffMembers.businessId,
    locationId: staffMembers.locationId,
    name: staffMembers.name,
    title: staffMembers.title,
    imageUrl: staffMembers.imageUrl,
    active: staffMembers.active,
    createdAt: staffMembers.createdAt,
    updatedAt: staffMembers.updatedAt,
    userId: staffMembers.userId,
  }).from(staffMembers)
    .where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).orderBy(asc(staffMembers.name));
  const staff = staffRows;
  const ownerIsOperator = staff.some((member) => member.userId === context.user.id);
  const emailConfigured = isStaffEmailConfigured();
  const catalog = await db.select({ id: services.id, name: services.name }).from(services)
    .where(and(eq(services.businessId, context.businessId), eq(services.active, true))).orderBy(asc(services.name));
  const categories = await db.select({ id: serviceCategories.id, name: serviceCategories.name }).from(serviceCategories)
    .where(and(eq(serviceCategories.businessId, context.businessId), eq(serviceCategories.active, true))).orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  const assignments = await db.select({ staffId: staffServices.staffId, serviceId: services.id, serviceName: services.name }).from(staffServices)
    .innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true)))
    .where(eq(staffServices.businessId, context.businessId));
  const shifts = await db.select().from(workingHours).where(eq(workingHours.businessId, context.businessId)).orderBy(asc(workingHours.weekday), asc(workingHours.startMinutes));
  const absences = await db.select().from(staffAbsences).where(eq(staffAbsences.businessId, context.businessId)).orderBy(asc(staffAbsences.startsAt));
  const invitations = await db.select().from(staffInvitations).where(eq(staffInvitations.businessId, context.businessId)).catch(() => []);

  return <main className="dashboard-shell"><AppNav businessName={context.businessName} role={context.role}/>
    <div className="page-heading"><div><p className="eyebrow">Organizzazione</p><h1>Staff</h1></div><p className="muted">Operatori, competenze, turni e assenze.</p></div>
    {!emailConfigured ? <div className="empty-state"><strong>Invio email non ancora attivo.</strong><br/>Configura RESEND_API_KEY e RESEND_FROM_EMAIL su Railway. Gli inviti inseriti resteranno pronti per il reinvio.</div> : null}
    <section className="management-grid"><article className="panel"><h2>Nuovo operatore</h2><form action={createStaffMember} className="compact-form stacked"><input name="name" placeholder="Nome e cognome" required/><input name="title" placeholder="Ruolo, es. Hair stylist"/><input name="email" type="email" placeholder="Email per invito (opzionale)"/><p className="muted">Se inserisci l’email, il sistema invia automaticamente il link di registrazione.</p><button className="primary-button">Aggiungi operatore</button></form>
      {context.role === "OWNER" ? ownerIsOperator ? <p className="status-pill">Il titolare è già presente come operatore.</p> : <form action={createOwnerStaffProfile} className="category-assignment"><p className="muted">Lavori anche nel salone? Crea il tuo profilo operativo senza un secondo account.</p><button className="ghost-button">Aggiungi titolare come operatore</button></form> : null}
    </article>
    {staff.length ? <article className="panel"><h2>Turni giornalieri</h2><p className="muted">Configura uno o due turni per il giorno scelto. Il salvataggio sostituisce i turni già presenti in quella giornata, evitando duplicazioni.</p><form action={saveWorkingDay} className="compact-form stacked"><label>Operatore<select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Giorno<select name="weekday">{weekdays.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><fieldset><legend>Primo turno</legend><div className="form-row"><label>Inizio<input name="firstStart" type="time" defaultValue="09:00" required/></label><label>Fine<input name="firstEnd" type="time" defaultValue="13:00" required/></label></div></fieldset><fieldset><legend>Secondo turno (facoltativo)</legend><div className="form-row"><label>Inizio<input name="secondStart" type="time"/></label><label>Fine<input name="secondEnd" type="time"/></label></div></fieldset><button className="primary-button">Salva giornata</button></form></article> : null}</section>
    {staff.length ? <section className="management-grid"><article className="panel"><h2>Associa servizio</h2>{catalog.length ? <form action={assignService} className="compact-form stacked"><select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select name="serviceId">{catalog.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><button className="primary-button">Abilita servizio</button></form> : <p className="muted">Crea prima un servizio.</p>} {categories.length ? <form action={assignCategory} className="compact-form stacked category-assignment"><select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select name="categoryId">{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button className="ghost-button">Abilita intera categoria</button></form> : null}</article>
    <article className="panel"><h2>Registra assenza</h2><AbsenceForm action={addAbsence} staff={staff.map(({ id, name }) => ({ id, name }))}/></article></section> : null}
    <section className="list-section"><h2>Operatori</h2>{staff.length ? <div className="data-list">{staff.map(member => {
      const memberAssignments = assignments.filter(assignment => assignment.staffId === member.id);
      const memberShifts = shifts.filter(shift => shift.staffId === member.id);
      const memberAbsences = absences.filter(absence => absence.staffId === member.id);
      const invitation = invitations.find(item => item.staffId === member.id);
      const isOwnerOperator = member.userId === context.user.id;
      return <article className="data-row staff-row" key={member.id}><div className="staff-card-main"><h3>{member.name} {isOwnerOperator ? <span className="status-pill">Titolare</span> : null}</h3><p className="muted">{member.title || "Operatore"}</p><div className="staff-compact-stats"><span>{memberAssignments.length} servizi</span><span>{memberShifts.length} turni</span>{member.userId ? <span>Account collegato</span> : null}</div><details className="staff-compact-details"><summary>Gestisci operatore</summary><div className="staff-compact-body">
        {!isOwnerOperator ? <div className="category-assignment"><strong>Account operatore</strong>{member.userId ? <p><span className="status-pill">Account collegato</span>{invitation ? <> · {invitation.email}</> : null}</p> : invitation ? <><p><strong>Email:</strong> {invitation.email}</p><p><span className="status-pill">{invitation.sentAt ? "Invito inviato" : "Invito da inviare"}</span> · scade il {invitation.expiresAt.toLocaleDateString("it-IT")}</p>{invitation.lastError ? <p className="form-error">{invitation.lastError}</p> : null}<form action={inviteStaffMember} className="compact-form"><input type="hidden" name="staffId" value={member.id}/><input type="hidden" name="email" value={invitation.email}/><button className="ghost-button">Reinvia invito</button></form></> : <form action={inviteStaffMember} className="compact-form stacked"><input type="hidden" name="staffId" value={member.id}/><input name="email" type="email" placeholder="Email operatore" required/><button className="ghost-button">Invia invito</button></form>}</div> : null}
        <div className="staff-services"><strong>Servizi associati</strong>{memberAssignments.length ? <div className="assignment-list">{memberAssignments.map(assignment => <form action={removeAssignedService} className="assignment-chip" key={assignment.serviceId}><input type="hidden" name="staffId" value={member.id}/><input type="hidden" name="serviceId" value={assignment.serviceId}/><span>{assignment.serviceName}</span><ConfirmSubmitButton className="assignment-remove" message={`Rimuovere ${assignment.serviceName} da ${member.name}?`}>Rimuovi</ConfirmSubmitButton></form>)}</div> : <p className="muted">Nessun servizio associato.</p>}</div>
        <div className="staff-services"><strong>Turni</strong>{memberShifts.length ? memberShifts.map(shift => {
          const weekdayIndex = weekdayValues.indexOf(shift.weekday);
          const dayShifts = memberShifts.filter(item => item.weekday === shift.weekday); const shiftNumber = dayShifts.findIndex(item => item.id === shift.id) + 1; const shiftLabel = `${weekdays[weekdayIndex]} · ${shiftNumber}° turno · ${formatMinutes(shift.startMinutes)}–${formatMinutes(shift.endMinutes)}`;
          return <details className="edit-disclosure" key={shift.id}><summary>{shiftLabel}</summary><form action={updateWorkingHours} className="compact-form stacked"><input type="hidden" name="id" value={shift.id}/><select name="weekday" defaultValue={weekdayIndex}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select><div className="form-row"><label>Inizio<input name="start" type="time" defaultValue={formatMinutes(shift.startMinutes)} required/></label><label>Fine<input name="end" type="time" defaultValue={formatMinutes(shift.endMinutes)} required/></label></div><button className="ghost-button">Salva turno</button></form><form action={deleteWorkingHours} className="button-row"><input type="hidden" name="id" value={shift.id}/><ConfirmSubmitButton message={`Eliminare il turno ${shiftLabel} di ${member.name}?`}>Elimina turno</ConfirmSubmitButton></form></details>;
        }) : <p className="muted">Nessun turno configurato.</p>}</div>
        {memberAbsences.length ? <p><strong>Assenze:</strong> {memberAbsences.map(absence => `${absence.startsAt.toLocaleDateString("it-IT")}–${absence.endsAt.toLocaleDateString("it-IT")}`).join(", ")}</p> : null}
        <details className="edit-disclosure"><summary>Modifica operatore</summary><form action={updateStaffMember} className="compact-form stacked"><input type="hidden" name="id" value={member.id}/><input name="name" defaultValue={member.name} required minLength={2}/><input name="title" defaultValue={member.title ?? ""} placeholder="Ruolo"/><button className="ghost-button">Salva modifiche</button></form></details></div></details>
      </div><form action={deleteStaffMember} className="delete-form"><input type="hidden" name="id" value={member.id}/><details><summary className="danger-button">{isOwnerOperator ? "Rimuovi dall’agenda" : "Elimina operatore"}</summary><p className="muted">{isOwnerOperator ? "Il titolare resterà attivo come account." : "Confermi la rimozione di "}{!isOwnerOperator ? member.name : ""}?</p><button className="danger-button" type="submit">Conferma eliminazione</button></details></form></article>;
    })}</div> : <div className="empty-state">Nessun operatore ancora.</div>}</section>
  </main>;
}






