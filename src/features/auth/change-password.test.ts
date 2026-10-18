import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase Auth simulado: cliente aislado (verificación) y cliente de la sesión del usuario.
const verifier = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
};
const session = { updateUser: vi.fn() };

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ getSupabaseEnv: () => ({ url: "https://demo.supabase.co", anonKey: "anon" }) }));
vi.mock("@/lib/auth", () => ({
  UNAUTHENTICATED_MESSAGE: "Tu sesión ha caducado.",
  getActionContext: vi.fn(async () => ({
    user: { id: "u1", email: "comercial@example.test", fullName: "Demo", timezone: "Europe/Madrid" },
    supabase: { auth: session },
  })),
}));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/supabase-js")>()),
  createClient: vi.fn(() => ({ auth: verifier })),
}));

import { AuthApiError } from "@supabase/supabase-js";
import { changePassword } from "./actions";

const input = { current_password: "actual123", password: "nueva1234", confirm_password: "nueva1234" };

beforeEach(() => {
  vi.clearAllMocks();
  verifier.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  session.updateUser.mockResolvedValue({ data: {}, error: null });
});

describe("cambio de contraseña", () => {
  it("verifica la contraseña actual y la cambia con Supabase Auth", async () => {
    const r = await changePassword(input);
    expect(r).toMatchObject({ ok: true });
    expect(verifier.signInWithPassword).toHaveBeenCalledWith({ email: "comercial@example.test", password: "actual123" });
    expect(verifier.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(session.updateUser).toHaveBeenCalledWith({ password: "nueva1234", current_password: "actual123" });
  });

  it("rechaza una contraseña actual incorrecta sin cambiar nada", async () => {
    verifier.signInWithPassword.mockResolvedValue({ data: {}, error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials") });
    const r = await changePassword(input);
    expect(r).toMatchObject({ ok: false, fieldErrors: { current_password: ["La contraseña actual no es correcta"] } });
    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it("valida la nueva contraseña antes de llamar a Supabase", async () => {
    const r = await changePassword({ ...input, confirm_password: "otra12345" });
    expect(r.ok).toBe(false);
    expect(verifier.signInWithPassword).not.toHaveBeenCalled();
  });

  it("muestra un mensaje claro si Supabase exige reautenticación", async () => {
    session.updateUser.mockResolvedValue({ data: {}, error: new AuthApiError("Reauthentication needed", 400, "reauthentication_needed") });
    const r = await changePassword(input);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/confirmar tu identidad/);
  });
});
