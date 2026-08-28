import { z } from "zod";

const tenantIdSchema = z.string().uuid();

export type TenantContext = Readonly<{
  businessId: string;
  actorId: string;
}>;

export function createTenantContext(input: TenantContext): TenantContext {
  return Object.freeze({
    businessId: tenantIdSchema.parse(input.businessId),
    actorId: tenantIdSchema.parse(input.actorId),
  });
}

export function assertTenantOwnership(context: TenantContext, resourceBusinessId: string): void {
  if (context.businessId !== resourceBusinessId) {
    throw new TenantIsolationError();
  }
}

export class TenantIsolationError extends Error {
  constructor() {
    super("La risorsa non appartiene al tenant corrente.");
    this.name = "TenantIsolationError";
  }
}
