"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/components/form/fields";
import { autofillLocality, lookupMessage } from "../autofill";
import { isSpanishPostalCode, looksLikeInvalidSpanishPostalCode, provinceForPostalCode, type PostalCodeLookup } from "../spain";

/**
 * Código postal + localidad. Al escribir un código postal español se consulta la
 * localidad (/api/postal-codes) y se rellena si el usuario no la ha escrito a mano.
 * Si la consulta falla, la localidad se introduce manualmente.
 */
export function PostalCodeFields() {
  const { control, getValues, setValue } = useFormContext();
  const postalCode = (useWatch({ control, name: "postal_code" }) as string | undefined) ?? "";
  const lastAutofilled = useRef<string | null>(null);
  const [lookup, setLookup] = useState<PostalCodeLookup | null>(null);
  const [filled, setFilled] = useState(false);
  const [loading, setLoading] = useState(false);

  const cp = postalCode.trim();
  const spanish = isSpanishPostalCode(cp);

  useEffect(() => {
    if (!spanish) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      let result: PostalCodeLookup;
      try {
        const res = await fetch(`/api/postal-codes/${encodeURIComponent(cp)}`, { signal: controller.signal });
        result = res.ok ? ((await res.json()) as PostalCodeLookup) : { status: "error", postalCode: cp, province: provinceForPostalCode(cp) };
      } catch {
        if (controller.signal.aborted) return;
        result = { status: "error", postalCode: cp, province: provinceForPostalCode(cp) };
      }
      setLoading(false);
      setLookup(result);
      const next = autofillLocality(String(getValues("locality") ?? ""), lastAutofilled.current, result);
      if (next) {
        setValue("locality", next, { shouldDirty: true, shouldValidate: true });
        lastAutofilled.current = next;
        setFilled(true);
      } else {
        setFilled(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
      setLoading(false);
    };
  }, [cp, spanish, getValues, setValue]);

  const current = spanish && lookup?.postalCode === cp ? lookup : null;
  const suggestions = current?.status === "found" ? current.localities : [];
  const province = spanish ? provinceForPostalCode(cp) : null;

  let localityHint: string | null = loading ? "Buscando localidad…" : lookupMessage(current, filled);
  if (!localityHint && province) localityHint = `Provincia: ${province}`;

  return (
    <>
      <TextField
        name="postal_code"
        label="Código postal"
        inputMode="text"
        autoComplete="off"
        maxLength={10}
        placeholder="28001"
        description={
          looksLikeInvalidSpanishPostalCode(cp)
            ? "No corresponde a ninguna provincia española. Si es un código extranjero, escribe la localidad a mano."
            : undefined
        }
      />
      <TextField
        name="locality"
        label="Localidad"
        autoComplete="off"
        list={suggestions.length > 1 ? "locality-options" : undefined}
        description={localityHint ? <span aria-live="polite">{localityHint}</span> : undefined}
      />
      {suggestions.length > 1 ? (
        <datalist id="locality-options">
          {suggestions.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
