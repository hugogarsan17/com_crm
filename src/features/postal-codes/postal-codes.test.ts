import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { autofillLocality, lookupMessage } from "./autofill";
import { lookupPostalCode } from "./lookup";
import {
  isSpanishPostalCode,
  isValidPostalCode,
  looksLikeInvalidSpanishPostalCode,
  parseZippopotamPlaces,
  provinceForPostalCode,
  type PostalCodeLookup,
} from "./spain";

const found = (localities: string[]): PostalCodeLookup => ({ status: "found", postalCode: "28001", province: "Madrid", localities });

describe("códigos postales españoles", () => {
  it("valida el formato español y acepta extranjeros", () => {
    expect(isSpanishPostalCode("28001")).toBe(true);
    expect(isSpanishPostalCode("52001")).toBe(true);
    expect(isSpanishPostalCode("53001")).toBe(false);
    expect(isSpanishPostalCode("00123")).toBe(false);
    expect(looksLikeInvalidSpanishPostalCode("99999")).toBe(true);
    expect(isValidPostalCode("SW1A 1AA")).toBe(true);
    expect(isValidPostalCode("1000-001")).toBe(true);
    expect(isValidPostalCode("28 001!")).toBe(false);
    expect(provinceForPostalCode("15142")).toBe("A Coruña");
    expect(provinceForPostalCode("SW1A 1AA")).toBeNull();
  });

  it("extrae localidades únicas de la respuesta del servicio", () => {
    expect(
      parseZippopotamPlaces({ places: [{ "place name": "Arteixo" }, { "place name": "arteixo" }, { "place name": " Loureda " }, {}] }),
    ).toEqual(["Arteixo", "Loureda"]);
    expect(parseZippopotamPlaces(null)).toEqual([]);
  });
});

describe("autocompletado de la localidad", () => {
  it("completa la localidad cuando está vacía", () => {
    expect(autofillLocality("", null, found(["Madrid"]))).toBe("Madrid");
  });

  it("sigue siendo editable: no sobrescribe lo que el usuario ha escrito", () => {
    expect(autofillLocality("Mi pueblo", null, found(["Madrid"]))).toBeNull();
    // El usuario editó la localidad que se había rellenado sola.
    expect(autofillLocality("Madrid centro", "Madrid", found(["Getafe"]))).toBeNull();
  });

  it("actualiza un valor rellenado automáticamente si cambia el código postal", () => {
    expect(autofillLocality("Madrid", "Madrid", found(["Getafe"]))).toBe("Getafe");
  });

  it("si la consulta falla o no encuentra nada, deja escribirla a mano", () => {
    const error: PostalCodeLookup = { status: "error", postalCode: "28001", province: "Madrid" };
    const notFound: PostalCodeLookup = { status: "not_found", postalCode: "28999", province: "Madrid" };
    expect(autofillLocality("", null, error)).toBeNull();
    expect(autofillLocality("", null, notFound)).toBeNull();
    expect(lookupMessage(error, false)).toMatch(/a mano/);
    expect(lookupMessage(notFound, false)).toMatch(/a mano/);
    expect(lookupMessage(found(["A", "B"]), true)).toMatch(/2 localidades/);
  });
});

describe("consulta al servicio de códigos postales", () => {
  const json = (status: number, body: unknown) =>
    vi.fn<(url: string) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("devuelve las localidades encontradas", async () => {
    const fetchMock = json(200, { places: [{ "place name": "Madrid" }] });
    const r = await lookupPostalCode("28001", fetchMock as unknown as typeof fetch);
    expect(r).toEqual({ status: "found", postalCode: "28001", province: "Madrid", localities: ["Madrid"] });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.zippopotam.us/es/28001");
  });

  it("distingue no encontrado, error y códigos no españoles", async () => {
    expect((await lookupPostalCode("28999", json(404, {}) as unknown as typeof fetch)).status).toBe("not_found");
    expect((await lookupPostalCode("28001", json(500, {}) as unknown as typeof fetch)).status).toBe("error");
    const failing = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect((await lookupPostalCode("28001", failing as unknown as typeof fetch)).status).toBe("error");
    const notCalled = vi.fn();
    expect((await lookupPostalCode("SW1A 1AA", notCalled as unknown as typeof fetch)).status).toBe("unsupported");
    expect(notCalled).not.toHaveBeenCalled();
  });
});
