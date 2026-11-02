import { describe, expect, it } from "vitest";
import { notificationsConfigStatus } from "./config";

describe("configuración del email de prueba", () => {
  it("informa de las variables que faltan sin mostrar valores", () => {
    expect(notificationsConfigStatus({})).toEqual({ emailConfigured: false, missing: ["RESEND_API_KEY", "NOTIFICATIONS_FROM_EMAIL"] });
    expect(notificationsConfigStatus({ RESEND_API_KEY: "re_x", NOTIFICATIONS_FROM_EMAIL: "a@b.c" })).toEqual({ emailConfigured: true, missing: [] });
  });
});
