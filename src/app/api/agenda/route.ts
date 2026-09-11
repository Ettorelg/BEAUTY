import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { appointmentAdditionalServices, appointmentProducts, appointmentRescheduleRequests, appointments, customerRelations, inventoryCategories, inventoryCategoryServiceCategories, inventoryCategoryServices, inventoryProducts, inventoryProductServices, services, staffAbsences, staffInvitations, staffMembers, staffServices } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { ensurePaymentSchema } from "@/lib/ensure-payment-schema";
import { ensureRescheduleSchema } from "@/lib/ensure-reschedule-schema";
import { ensureInventorySchema } from "@/lib/ensure-inventory-schema";
import { ensureAdditionalServicesSchema } from "@/lib/ensure-additional-services-schema";
import { addCalendarDays, addCalendarMonths, addCalendarYears, startOfCalendarMonth, startOfCalendarWeek, startOfCalendarYear, type AgendaView } from "@/modules/agenda/domain/calendar";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

export async function GET(request: NextRequest) {
  await ensureFidelitySchema();
  await ensurePaymentSchema();
  await ensureRescheduleSchema();
  const context = await requireBusinessContext();
  if(context.modules.includes("INVENTORY")) await ensureInventorySchema();
  await ensureAdditionalServicesSchema();
  const isOwner = context.role === "OWNER";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(new Date());
  const requestedDate = request.nextUrl.searchParams.get("date") ?? today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  const requestedView = request.nextUrl.searchParams.get("view");
  const view: AgendaView = requestedView === "week" ? "week" : requestedView === "month" ? "month" : requestedView === "year" && isOwner ? "year" : "day";
  const startDate = view === "week" ? startOfCalendarWeek(date) : view === "month" ? startOfCalendarMonth(date) : view === "year" ? startOfCalendarYear(date) : date;
  const endDate = view === "year" ? addCalendarYears(startDate, 1) : view === "month" ? addCalendarMonths(startDate, 1) : addCalendarDays(startDate, view === "week" ? 7 : 1);
  const start = zonedLocalToUtc(`${startDate}T00:00`, context.timezone);
  const end = zonedLocalToUtc(`${endDate}T00:00`, context.timezone);

  let [ownStaff] = isOwner
    ? [undefined]
    : await db
        .select({ id: staffMembers.id, name: staffMembers.name })
        .from(staffMembers)
        .where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.userId, context.user.id), eq(staffMembers.active, true)))
        .limit(1);

  if (!isOwner && !ownStaff) {
    [ownStaff] = await db
      .select({ id: staffMembers.id, name: staffMembers.name })
      .from(staffInvitations)
      .innerJoin(staffMembers, and(eq(staffInvitations.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true)))
      .where(and(eq(staffInvitations.businessId, context.businessId), eq(staffInvitations.email, context.user.email.toLowerCase()), eq(staffInvitations.acceptedAt, staffInvitations.acceptedAt)))
      .limit(1);
  }

  if (!isOwner && !ownStaff) {
    return NextResponse.json({ date, startDate, view, timezone: context.timezone, canManage: false, staff: [], catalog: [], entries: [] });
  }

  const staffCondition = isOwner
    ? eq(staffMembers.businessId, context.businessId)
    : and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.id, ownStaff!.id));

  const [staff, catalog, rawEntries, absences] = await Promise.all([
    db
      .select({ id: staffMembers.id, name: staffMembers.name })
      .from(staffMembers)
      .where(and(staffCondition, eq(staffMembers.active, true)))
      .orderBy(asc(staffMembers.name)),
    isOwner
      ? db
          .select({ staffId: staffServices.staffId, id: services.id, name: services.name, duration: services.durationMinutes })
          .from(staffServices)
          .innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true)))
          .where(eq(staffServices.businessId, context.businessId))
          .orderBy(asc(services.name))
      : Promise.resolve([]),
    db
      .select({
        id: appointments.id,
        customerId: appointments.customerRelationId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        serviceId: appointments.serviceId,
        serviceCategoryId: services.categoryId,
        serviceName: appointments.serviceName,
        customerName: customerRelations.name,
        staffId: staffMembers.id,
        staffName: staffMembers.name,
        price: appointments.price,
        paymentStatus: appointments.paymentStatus,
        notes: appointments.notes,
      })
      .from(appointments)
      .innerJoin(services, and(eq(appointments.serviceId, services.id), eq(services.businessId, context.businessId)))
      .leftJoin(customerRelations, and(eq(appointments.customerRelationId, customerRelations.id), eq(customerRelations.businessId, context.businessId)))
      .innerJoin(staffMembers, and(eq(appointments.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId)))
      .where(
        and(
          eq(appointments.businessId, context.businessId),
          isOwner ? undefined : eq(appointments.staffId, ownStaff!.id),
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
        ),
      )
      .orderBy(asc(appointments.startsAt)),
    db.select({ staffId: staffAbsences.staffId, startsAt: staffAbsences.startsAt, endsAt: staffAbsences.endsAt })
      .from(staffAbsences).where(and(eq(staffAbsences.businessId, context.businessId), lt(staffAbsences.startsAt, end), gte(staffAbsences.endsAt, start))),
  ]);

  const customerIds = [...new Set(rawEntries.map((entry) => entry.customerId))];
  const serviceIds = [...new Set(rawEntries.map((entry) => entry.serviceId))];
  const unpaidRows = customerIds.length
    ? await db.select({ customerId: appointments.customerRelationId, price: appointments.price }).from(appointments).where(and(
        eq(appointments.businessId, context.businessId), eq(appointments.status, "COMPLETED"),
        eq(appointments.paymentStatus, "UNPAID"), inArray(appointments.customerRelationId, customerIds),
      ))
    : [];
  const outstandingByCustomer = unpaidRows.reduce((map, row) => map.set(row.customerId, (map.get(row.customerId) ?? 0) + Number(row.price)), new Map<string, number>());
  const noteHistory = customerIds.length && serviceIds.length
    ? await db.select({ customerId: appointments.customerRelationId, serviceId: appointments.serviceId, startsAt: appointments.startsAt, notes: appointments.notes })
        .from(appointments)
        .where(and(
          eq(appointments.businessId, context.businessId),
          eq(appointments.status, "COMPLETED"),
          inArray(appointments.customerRelationId, customerIds),
          inArray(appointments.serviceId, serviceIds),
          isNotNull(appointments.notes),
        ))
        .orderBy(desc(appointments.startsAt))
    : [];
  const entries = rawEntries.map((entry) => ({
    ...entry,
    previousOutstanding: outstandingByCustomer.get(entry.customerId) ?? 0,
    absenceConflict: ["BOOKED", "CONFIRMED", "ARRIVED"].includes(entry.status) && absences.some((absence) => absence.staffId === entry.staffId && absence.startsAt < entry.endsAt && absence.endsAt > entry.startsAt),
    rememberedNote: noteHistory.find((item) =>
      item.customerId === entry.customerId &&
      item.serviceId === entry.serviceId &&
      item.startsAt < entry.startsAt &&
      Boolean(item.notes?.trim()),
    )?.notes ?? null,
  }));

  const appointmentIds=rawEntries.map(entry=>entry.id);
  const [additionalServiceCatalog,additionalServices]=await Promise.all([
    db.select({id:services.id,name:services.name,duration:services.durationMinutes,price:services.price}).from(services).where(and(eq(services.businessId,context.businessId),eq(services.active,true))).orderBy(asc(services.name)),
    appointmentIds.length?db.select({appointmentId:appointmentAdditionalServices.appointmentId,name:appointmentAdditionalServices.serviceName,duration:appointmentAdditionalServices.durationMinutes,price:appointmentAdditionalServices.price}).from(appointmentAdditionalServices).where(and(eq(appointmentAdditionalServices.businessId,context.businessId),inArray(appointmentAdditionalServices.appointmentId,appointmentIds))):Promise.resolve([]),
  ]);
  const [inventoryCatalog,usedProducts,directProductLinks,categoryServiceLinks,categoryGroupLinks]=context.modules.includes("INVENTORY")?await Promise.all([
    db.select({id:inventoryProducts.id,name:inventoryProducts.name,stock:inventoryProducts.stock,price:inventoryProducts.salePrice,categoryId:inventoryProducts.categoryId,categoryName:inventoryCategories.name}).from(inventoryProducts).leftJoin(inventoryCategories,eq(inventoryCategories.id,inventoryProducts.categoryId)).where(eq(inventoryProducts.businessId,context.businessId)).orderBy(asc(inventoryProducts.name)),
    appointmentIds.length?db.select({appointmentId:appointmentProducts.appointmentId,name:appointmentProducts.description,quantity:appointmentProducts.quantity,unitPrice:appointmentProducts.unitPrice}).from(appointmentProducts).where(and(eq(appointmentProducts.businessId,context.businessId),inArray(appointmentProducts.appointmentId,appointmentIds))):Promise.resolve([]),
    db.select({productId:inventoryProductServices.productId,serviceId:inventoryProductServices.serviceId}).from(inventoryProductServices).where(eq(inventoryProductServices.businessId,context.businessId)),
    db.select({categoryId:inventoryCategoryServices.inventoryCategoryId,serviceId:inventoryCategoryServices.serviceId}).from(inventoryCategoryServices).where(eq(inventoryCategoryServices.businessId,context.businessId)),
    db.select({categoryId:inventoryCategoryServiceCategories.inventoryCategoryId,serviceCategoryId:inventoryCategoryServiceCategories.serviceCategoryId}).from(inventoryCategoryServiceCategories).where(eq(inventoryCategoryServiceCategories.businessId,context.businessId)),
  ]):[[],[],[],[],[]];
  const productTotals=new Map<string,number>();for(const item of usedProducts)productTotals.set(item.appointmentId,(productTotals.get(item.appointmentId)??0)+Number(item.unitPrice)*item.quantity);
  const enrichedEntries=entries.map(entry=>{const categoryIds=new Set([...categoryServiceLinks.filter(link=>link.serviceId===entry.serviceId).map(link=>link.categoryId),...categoryGroupLinks.filter(link=>link.serviceCategoryId===entry.serviceCategoryId).map(link=>link.categoryId)]);const extras=additionalServices.filter(item=>item.appointmentId===entry.id);return {...entry,productTotal:productTotals.get(entry.id)??0,additionalServiceTotal:extras.reduce((sum,item)=>sum+Number(item.price),0),additionalServices:extras,recommendedProductIds:[...new Set([...directProductLinks.filter(link=>link.serviceId===entry.serviceId).map(link=>link.productId),...inventoryCatalog.filter(product=>product.categoryId&&categoryIds.has(product.categoryId)).map(product=>product.id)])]};});

  const rescheduleRequests = await db.select({ id: appointmentRescheduleRequests.id, appointmentId: appointmentRescheduleRequests.appointmentId, proposedStartsAt: appointmentRescheduleRequests.proposedStartsAt, customerName: customerRelations.name, serviceName: appointments.serviceName, currentStaffId: appointments.staffId, proposedStaffId: appointmentRescheduleRequests.proposedStaffId })
    .from(appointmentRescheduleRequests).innerJoin(appointments, eq(appointments.id, appointmentRescheduleRequests.appointmentId)).leftJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId)).where(and(eq(appointmentRescheduleRequests.businessId, context.businessId), eq(appointmentRescheduleRequests.proposerType, "CUSTOMER"), eq(appointmentRescheduleRequests.status, "PENDING"), gt(appointmentRescheduleRequests.expiresAt, new Date()), isOwner ? undefined : eq(appointments.staffId, ownStaff!.id)));
  const staffNames = new Map(staff.map(member => [member.id, member.name]));
  return NextResponse.json({ date, startDate, view, timezone: context.timezone, canManage: isOwner, inventoryEnabled: context.modules.includes("INVENTORY"), inventoryCatalog, usedProducts, additionalServiceCatalog, staff, catalog, entries:enrichedEntries, rescheduleRequests: rescheduleRequests.map(request => ({ ...request, proposedStaffName: staffNames.get(request.proposedStaffId) ?? "Operatore", proposedStartsAt: request.proposedStartsAt.toISOString() })) });
}

