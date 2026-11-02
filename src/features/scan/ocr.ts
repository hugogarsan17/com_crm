import type { OcrWord } from "./consulta-abreviada";

// Tamaño de trabajo del OCR: con la hoja entera en ~3000 px de lado largo los caracteres
// rondan los 40 px de alto. En fotos pequeñas Tesseract confunde M/N y cifras (8→0), así
// que se amplían (hasta ×3); las muy grandes se reducen para no ralentizar el navegador.
const TARGET_SIDE = 3000;
const MAX_UPSCALE = 3;

async function prepareImage(file: File): Promise<Blob | File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(MAX_UPSCALE, TARGET_SIDE / Math.max(bitmap.width, bitmap.height));
    if (Math.abs(scale - 1) < 0.1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    bitmap.close();
    return await new Promise<Blob | File>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/png"));
  } catch {
    return file;
  }
}

export type OcrProgress = { status: string; progress: number };

/**
 * Reconoce el texto de una imagen EN EL NAVEGADOR (Tesseract.js, español).
 * La imagen no se envía a ningún servidor ni se guarda: solo vive en memoria
 * durante el reconocimiento. Devuelve el texto y las palabras con posición y confianza.
 */
export async function recognizeImage(file: File, onProgress: (p: OcrProgress) => void): Promise<{ text: string; words: OcrWord[] }> {
  onProgress({ status: "Preparando la imagen…", progress: 0 });
  const image = await prepareImage(file);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    logger: (m) =>
      onProgress(
        m.status === "recognizing text"
          ? { status: "Leyendo el texto…", progress: m.progress }
          : { status: "Cargando el lector (solo la primera vez)…", progress: 0 },
      ),
  });
  try {
    // Conserva los espacios entre palabras: la hoja es de ancho fijo y las columnas importan.
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
    const words: OcrWord[] = (data.blocks ?? []).flatMap((b) =>
      b.paragraphs.flatMap((p) =>
        p.lines.flatMap((l) =>
          l.words.map((w) => ({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, confidence: w.confidence })),
        ),
      ),
    );
    return { text: data.text, words };
  } finally {
    await worker.terminate();
  }
}
