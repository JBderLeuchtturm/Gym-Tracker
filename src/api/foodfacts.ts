/**
 * Open Food Facts: Barcode nachschlagen, Naehrwerte uebernehmen.
 *
 * Kostenlos, ohne Konto, ohne Schluessel - eine offene Datenbank mit ueber drei
 * Millionen Produkten. Es wird nur die Produkt-ID (der Barcode) abgefragt, sonst
 * nichts. Findet die Datenbank nichts, traegt man die Werte weiter von Hand ein.
 */

export interface FoodProduct {
  barcode: string;
  name: string;
  brand: string;
  /** Naehrwerte je 100 g bzw. 100 ml. */
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
  /** Uebliche Portion in Gramm, falls hinterlegt. */
  servingG: number | null;
}

const num = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : null;
};

/** Nur Ziffern, 8 bis 14 Stellen - EAN-8, UPC-A, EAN-13, ITF-14. */
export const isBarcode = (code: string): boolean => /^\d{8,14}$/.test(code.trim());

export async function lookupProduct(barcode: string): Promise<FoodProduct | null> {
  const code = barcode.trim();
  if (!isBarcode(code)) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json`
    + '?fields=product_name,product_name_de,brands,nutriments,serving_quantity';

  let payload: {
    status?: number;
    product?: {
      product_name?: string;
      product_name_de?: string;
      brands?: string;
      serving_quantity?: number | string;
      nutriments?: Record<string, unknown>;
    };
  };
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    payload = await response.json();
  } catch {
    return null;
  }

  if (payload.status !== 1 || !payload.product) return null;
  const product = payload.product;
  const nutriments = product.nutriments ?? {};

  return {
    barcode: code,
    name: (product.product_name_de || product.product_name || '').trim() || 'Unbenanntes Produkt',
    brand: (product.brands || '').split(',')[0]?.trim() ?? '',
    kcal100: num(nutriments['energy-kcal_100g']),
    protein100: num(nutriments.proteins_100g),
    carbs100: num(nutriments.carbohydrates_100g),
    fat100: num(nutriments.fat_100g),
    servingG: num(product.serving_quantity),
  };
}

/** Rechnet die Naehrwerte eines Produkts auf eine Menge in Gramm um. */
export function scaleProduct(product: FoodProduct, grams: number): {
  kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null;
} {
  const factor = grams / 100;
  const scale = (value: number | null) => (value == null ? null : Math.round(value * factor));
  return {
    kcal: scale(product.kcal100),
    proteinG: scale(product.protein100),
    carbsG: scale(product.carbs100),
    fatG: scale(product.fat100),
  };
}
