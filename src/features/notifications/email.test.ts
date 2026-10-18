import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendEmail } from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendEmail", () => {
  it("sin credenciales no llama al proveedor ni simula el envío", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NOTIFICATIONS_FROM_EMAIL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendEmail({ to: "a@example.test", subject: "x", html: "x", text: "x" });
    expect(r).toMatchObject({ ok: false, notConfigured: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve el error del proveedor en vez de darlo por enviado", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("NOTIFICATIONS_FROM_EMAIL", "Cartera <avisos@example.test>");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Domain not verified" }), { status: 403 })));
    const r = await sendEmail({ to: "a@example.test", subject: "x", html: "x", text: "x", idempotencyKey: "k1" });
    expect(r).toEqual({ ok: false, error: "Resend respondió 403: Domain not verified" });
  });

  it("envía con la API de Resend desde el servidor", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("NOTIFICATIONS_FROM_EMAIL", "Cartera <avisos@example.test>");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendEmail({ to: "a@example.test", subject: "Asunto", html: "<p>x</p>", text: "x", idempotencyKey: "k1" });
    expect(r).toEqual({ ok: true, id: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "Cartera <avisos@example.test>", to: ["a@example.test"], subject: "Asunto" });
  });
});
