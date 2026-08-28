import { describe, expect, it } from "vitest";
import {
  assertTenantOwnership,
  createTenantContext,
  TenantIsolationError,
} from "./tenant-context";

const businessId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";

describe("tenant context", () => {
  it("accetta una risorsa dello stesso tenant", () => {
    const context = createTenantContext({ businessId, actorId });
    expect(() => assertTenantOwnership(context, businessId)).not.toThrow();
  });

  it("blocca una risorsa di un altro tenant", () => {
    const context = createTenantContext({ businessId, actorId });
    expect(() =>
      assertTenantOwnership(context, "33333333-3333-4333-8333-333333333333"),
    ).toThrow(TenantIsolationError);
  });

  it("rifiuta identificativi tenant non validi", () => {
    expect(() => createTenantContext({ businessId: "non-valido", actorId })).toThrow();
  });
});
