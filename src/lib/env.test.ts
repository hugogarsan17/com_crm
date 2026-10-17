import { describe, expect, it } from "vitest";
import { cleanEnvValue, resolveSupabaseEnv } from "./env";

describe("variables de entorno de Supabase", () => {
  it("trata los valores en blanco como ausentes", () => {
    expect(cleanEnvValue(undefined)).toBeUndefined();
    expect(cleanEnvValue("")).toBeUndefined();
    expect(cleanEnvValue("   ")).toBeUndefined();
    expect(cleanEnvValue("\n")).toBeUndefined();
  });

  it("quita espacios y comillas copiadas por error", () => {
    expect(cleanEnvValue("  sb_publishable_abc \n")).toBe("sb_publishable_abc");
    expect(cleanEnvValue('"sb_publishable_abc"')).toBe("sb_publishable_abc");
    expect(cleanEnvValue("'https://x.supabase.co'")).toBe("https://x.supabase.co");
  });

  it("usa la publishable key si la anon key está vacía o en blanco", () => {
    expect(resolveSupabaseEnv({ url: "https://x.supabase.co", anonKey: " ", publishableKey: "sb_publishable_abc" })).toEqual({
      url: "https://x.supabase.co",
      anonKey: "sb_publishable_abc",
    });
    expect(resolveSupabaseEnv({ url: "https://x.supabase.co", anonKey: "jwt.anon", publishableKey: "sb_publishable_abc" }).anonKey).toBe(
      "jwt.anon",
    );
    expect(resolveSupabaseEnv({ url: " ", anonKey: "", publishableKey: "" })).toEqual({ url: undefined, anonKey: undefined });
  });
});
