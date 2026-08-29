import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { serviceCategories, services, staffAbsences, staffMembers, staffServices, workingHours } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { formatMinutes } from "@/modules/availability/domain/time-slots";
import { AppNav } from "../app-nav";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { addAbsence, addWorkingHours, assignCategory, assignService, createStaffMember, deleteStaffMember, deleteWorkingHours, removeAssignedService, updateStaffMember, updateWorkingHours } from "./actions";

const weekdays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const weekdayValues = [1, 2, 3, 4, 5, 6, 0];

export default async function StaffPage() {
  const context = await requireBusinessContext();
  const staff = await db.select().from(staffMembers)
    .where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).orderBy(asc(staffMembers.name));
  const catalog = await db.select({ id: services.id, name: services.name }).from(services)
    .where(and(eq(services.businessId, context.businessId), eq(services.active, true))).orderBy(asc(services.name));
  const categories = await db.select({ id: serviceCategories.id, name: serviceCategories.name }).from(serviceCategories)
    .where(and(eq(serviceCategories.businessId, context.businessId), eq(serviceCategories.active, true))).orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  const assignments = await db.select({ staffId: staffServices.staffId, serviceId: services.id, serviceName: services.name }).from(staffServices)
    .innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true)))
    .where(eq(staffServices.businessId, context.businessId));
  const shifts = await db.select().from(workingHours).where(eq(workingHours.businessId, context.businessId)).orderBy(asc(workingHours.weekday), asc(workingHours.startMinutes));
  const absences = await db.select().from(staffAbsences).where(eq(staffAbsences.businessId, context.businessId)).orderBy(asc(staffAbsences.startsAt));

  return <main className="dashboard-shell"><AppNav businessName={context.businessName} role={context.role}/>
    <div className="page-heading"><div><p className="eyebrow">Organizzazione</p><h1>Staff</h1></div><p className="muted">Operatori, competenze, turni e assenze.</p></div>
    <section className="management-grid"><article className="panel"><h2>Nuovo operatore</h2><form action={createStaffMember} className="compact-form stacked"><input name="name" placeholder="Nome e cognome" required/><input name="title" placeholder="Ruolo, es. Hair stylist"/><button className="primary-button">Aggiungi operatore</button></form></article>
    {staff.length ? <article className="panel"><h2>Configura disponibilità</h2><form action={addWorkingHours} className="compact-form stacked"><select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select name="weekday">{weekdays.map((d,i)=><option value={i} key={d}>{d}</option>)}</select><div className="form-row"><label>Inizio<input name="start" type="time" defaultValue="09:00" required/></label><label>Fine<input name="end" type="time" defaultValue="18:00" required/></label></div><button className="primary-button">Aggiungi turno</button></form></article> : null}</section>
    {staff.length ? <section className="management-grid"><article className="panel"><h2>Associa servizio</h2>{catalog.length ? <form action={assignService} className="compact-form stacked"><select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select name="serviceId">{catalog.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><button className="primary-button">Abilita servizio</button></form> : <p className="muted">Crea prima un servizio.</p>} {categories.length ? <form action={assignCategory} className="compact-form stacked category-assignment"><select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select name="categoryId">{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button className="ghost-button">Abilita intera categoria</button></form> : null}</article>
    <article className="panel"><h2>Registra assenza</h2><form action={addAbsence} className="compact-form stacked"><select name="staffId">{staff.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><div className="form-row"><label>Da<input name="startsAt" type="datetime-local" required/></label><label>A<input name="endsAt" type="datetime-local" required/></label></div><input name="reason" placeholder="Motivo (opzionale)"/><button className="primary-button">Aggiungi assenza</button></form></article></section> : null}
    <section className="list-section"><h2>Operatori</h2>{staff.length ? <div className="data-list">{staff.map(member => {
      const memberAssignments = assignments.filter(assignment => assignment.staffId === member.id);
      const memberShifts = shifts.filter(shift => shift.staffId === member.id);
      const memberAbsences = absences.filter(absence => absence.staffId === member.id);
      return <article className="data-row staff-row" key={member.id}><div className="staff-card-main"><h3>{member.name}</h3><p className="muted">{member.title || "Operatore"}</p>
        <div className="staff-services"><strong>Servizi associati</strong>{memberAssignments.length ? <div className="assignment-list">{memberAssignments.map(assignment => <form action={removeAssignedService} className="assignment-chip" key={assignment.serviceId}><input type="hidden" name="staffId" value={member.id}/><input type="hidden" name="serviceId" value={assignment.serviceId}/><span>{assignment.serviceName}</span><ConfirmSubmitButton className="assignment-remove" message={`Rimuovere ${assignment.serviceName} da ${member.name}?`}>Rimuovi</ConfirmSubmitButton></form>)}</div> : <p className="muted">Nessun servizio associato.</p>}</div>
        <div className="staff-services"><strong>Turni</strong>{memberShifts.length ? memberShifts.map(shift => {
          const weekdayIndex = weekdayValues.indexOf(shift.weekday);
          const shiftLabel = `${weekdays[weekdayIndex]} ${formatMinutes(shift.startMinutes)}–${formatMinutes(shift.endMinutes)}`;
          return <details className="edit-disclosure" key={shift.id}><summary>{shiftLabel}</summary><form action={updateWorkingHours} className="compact-form stacked"><input type="hidden" name="id" value={shift.id}/><select name="weekday" defaultValue={weekdayIndex}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select><div className="form-row"><label>Inizio<input name="start" type="time" defaultValue={formatMinutes(shift.startMinutes)} required/></label><label>Fine<input name="end" type="time" defaultValue={formatMinutes(shift.endMinutes)} required/></label></div><button className="ghost-button">Salva turno</button></form><form action={deleteWorkingHours} className="button-row"><input type="hidden" name="id" value={shift.id}/><ConfirmSubmitButton message={`Eliminare il turno ${shiftLabel} di ${member.name}?`}>Elimina turno</ConfirmSubmitButton></form></details>;
        }) : <p className="muted">Nessun turno configurato.</p>}</div>
        {memberAbsences.length ? <p><strong>Assenze:</strong> {memberAbsences.map(absence => `${absence.startsAt.toLocaleDateString("it-IT")}–${absence.endsAt.toLocaleDateString("it-IT")}`).join(", ")}</p> : null}
        <details className="edit-disclosure"><summary>Modifica operatore</summary><form action={updateStaffMember} className="compact-form stacked"><input type="hidden" name="id" value={member.id}/><input name="name" defaultValue={member.name} required minLength={2}/><input name="title" defaultValue={member.title ?? ""} placeholder="Ruolo"/><button className="ghost-button">Salva modifiche</button></form></details>
      </div><form action={deleteStaffMember} className="delete-form"><input type="hidden" name="id" value={member.id}/><ConfirmSubmitButton message={`Eliminare ${member.name}? Verranno rimossi anche servizi associati, turni e assenze.`}>Elimina operatore</ConfirmSubmitButton></form></article>;
    })}</div> : <div className="empty-state">Nessun operatore ancora.</div>}</section>
  </main>;
}
