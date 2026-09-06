/**
 * Open Food Facts: Lebensmittel nachschlagen, Naehrwerte uebernehmen.
 *
 * Kostenlos, ohne Konto, ohne Schluessel - eine offene Datenbank mit ueber drei
 * Millionen Produkten. Gesucht wird ueber den Barcode oder ueber einen
 * Suchbegriff; uebermittelt wird nur genau das. Findet die Datenbank nichts,
 * traegt man die Werte weiter von Hand ein.
 */

const HOST = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_quantity,quantity';

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

interface RawProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, unknown>;
}

function toProduct(raw: RawProduct, fallbackCode = ''): FoodProduct {
  const nutriments = raw.nutriments ?? {};
  return {
    barcode: (raw.code || fallbackCode).trim(),
    name: (raw.product_name_de || raw.product_name || '').trim() || 'Unbenanntes Produkt',
    brand: (raw.brands || '').split(',')[0]?.trim() ?? '',
    kcal100: num(nutriments['energy-kcal_100g']),
    protein100: num(nutriments.proteins_100g),
    carbs100: num(nutriments.carbohydrates_100g),
    fat100: num(nutriments.fat_100g),
    servingG: num(raw.serving_quantity),
  };
}

export async function lookupProduct(barcode: string): Promise<FoodProduct | null> {
  const code = barcode.trim();
  if (!isBarcode(code)) return null;

  try {
    const response = await fetch(
      `${HOST}/api/v2/product/${code}.json?fields=${FIELDS}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const payload = await response.json() as { status?: number; product?: RawProduct };
    if (payload.status !== 1 || !payload.product) return null;
    return toProduct(payload.product, code);
  } catch {
    return null;
  }
}

/**
 * Sucht Lebensmittel ueber einen Begriff. Ergebnisse ohne Namen oder ohne
 * Kalorienangabe fallen raus - mit denen kann man nichts anfangen.
 */
export async function searchProducts(query: string): Promise<FoodProduct[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const url = `${HOST}/cgi/search.pl?search_terms=${encodeURIComponent(term)}`
    + `&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`;

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const payload = await response.json() as { products?: RawProduct[] };
    const seen = new Set<string>();
    return (payload.products ?? [])
      .map((raw) => toProduct(raw))
      .filter((product) => {
        if (product.kcal100 == null || product.name === 'Unbenanntes Produkt') return false;
        const key = `${product.name}|${product.brand}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 15);
  } catch {
    return [];
  }
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
