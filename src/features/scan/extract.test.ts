import { describe, expect, it } from "vitest";
import { extractLeadFields } from "./extract";

const products = [
  { code: "decesos", label: "Decesos", active: true },
  { code: "hogar", label: "Hogar", active: true },
  { code: "auto", label: "Auto", active: true },
];

describe("extractLeadFields", () => {
  it("lee una ficha con etiquetas «Campo: valor»", () => {
    const text = `FICHA DE CLIENTE
Nombre y apellidos: MARÍA JOSÉ DE LA FUENTE
Teléfono: 600 12 34 56
Email: maria.demo@example.test
Dirección: Calle Mayor 3
C.P.: 28001   Localidad: MADRID
Nº de póliza: POL-2024-0099
Seguro de decesos: Sí
Producto: Hogar`;
    expect(extractLeadFields(text, products)).toEqual({
      full_name: "María José de la Fuente",
      phone: "600 123 456",
      email: "maria.demo@example.test",
      postal_code: "28001",
      locality: "Madrid",
      customer_reference: "POL-2024-0099",
      has_funeral_insurance: "yes",
      product_code: "hogar",
    });
  });

  it("une nombre y apellidos en campos separados y admite el valor en la línea siguiente", () => {
    const text = `Nombre
Ana
Apellidos
García López
Móvil
+34 699-111-222`;
    const r = extractLeadFields(text);
    expect(r.full_name).toBe("Ana García López");
    expect(r.phone).toBe("+34 699 111 222");
  });

  it("deduce teléfono, email, CP y localidad sin etiquetas", () => {
    const r = extractLeadFields(`Pedro Ruiz\nAvda. del Puerto 12, 46001 Valencia\n655443322\npedro.demo @ example.test`);
    expect(r).toMatchObject({ phone: "655 443 322", postal_code: "46001", locality: "Valencia", email: "pedro.demo@example.test" });
    // Sin etiqueta no se adivina el nombre.
    expect(r.full_name).toBeUndefined();
  });

  it("no confunde títulos ni otros campos con el nombre", () => {
    const r = extractLeadFields(`Ficha de cliente\nNombre:\nTeléfono: 611 222 333`);
    expect(r.full_name).toBeUndefined();
    expect(r.phone).toBe("611 222 333");
  });

  it("no toma como código postal números de póliza ni provincias inexistentes", () => {
    const r = extractLeadFields(`Póliza: 12345\nCódigo postal 99999`);
    expect(r.customer_reference).toBe("12345");
    expect(r.postal_code).toBeUndefined();
  });

  it("decesos «No» y producto de decesos solo si viene etiquetado como producto", () => {
    expect(extractLeadFields("Decesos: no", products)).toEqual({ has_funeral_insurance: "no" });
    expect(extractLeadFields("Seguro de decesos: X", products)).toEqual({ has_funeral_insurance: "yes" });
  });

  it("repara la «@» mal leída solo en el campo Email", () => {
    expect(extractLeadFields("Email: laura.demoQexample.test").email).toBe("laura.demo@example.test");
    expect(extractLeadFields("Correo: pepe.demo©example.test").email).toBe("pepe.demo@example.test");
    // Sin etiqueta no se arriesga.
    expect(extractLeadFields("laura.demoQexample.test").email).toBeUndefined();
  });

  it("devuelve vacío si el texto no tiene datos reconocibles", () => {
    expect(extractLeadFields("lorem ipsum dolor sit amet")).toEqual({});
  });
});
