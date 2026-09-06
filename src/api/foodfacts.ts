/**
 * Open Food Facts: Lebensmittel nachschlagen, Naehrwerte uebernehmen.
 *
 * Kostenlos, ohne Konto, ohne Schluessel - eine offene Datenbank mit ueber drei
 * Millionen Produkten. Gesucht wird ueber den Barcode oder ueber einen
 * Suchbegriff; uebermittelt wird nur genau das. Findet die Datenbank nichts,
 * traegt man die Werte weiter von Hand ein.
 *
 * Die Textsuche geht zuerst an den Volltextdienst von Open Food Facts (nach
 * Bekanntheit sortiert, deutschsprachig bevorzugt); klappt der nicht, faellt
 * sie auf die deutsche und dann die weltweite Instanz zurueck.
 */

const WORLD = 'https://world.openfoodfacts.org';
const GERMANY = 'https://de.openfoodfacts.org';
const SEARCH = 'https://search.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_de,product_name_en,brands,nutriments,serving_quantity,quantity';

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

/**
 * Kalorien je 100 g. Fehlt der kcal-Wert direkt, wird aus Kilojoule
 * umgerechnet - so ueberleben deutlich mehr Eintraege.
 */
function kcalPer100(nutriments: Record<string, unknown>): number | null {
  const direct = num(nutriments['energy-kcal_100g']);
  if (direct != null) return direct;
  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments.energy_100g);
  return kj != null ? Math.round(kj / 4.184) : null;
}

/** Nur Ziffern, 8 bis 14 Stellen - EAN-8, UPC-A, EAN-13, ITF-14. */
export const isBarcode = (code: string): boolean => /^\d{8,14}$/.test(code.trim());

interface RawProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  product_name_en?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, unknown>;
}

function toProduct(raw: RawProduct, fallbackCode = ''): FoodProduct {
  const nutriments = raw.nutriments ?? {};
  const name = (raw.product_name_de || raw.product_name || raw.product_name_en || '').trim();
  return {
    barcode: (raw.code || fallbackCode).trim(),
    name: name || 'Unbenanntes Produkt',
    brand: (raw.brands || '').split(',')[0]?.trim() ?? '',
    kcal100: kcalPer100(nutriments),
    protein100: num(nutriments.proteins_100g),
    carbs100: num(nutriments.carbohydrates_100g),
    fat100: num(nutriments.fat_100g),
    servingG: num(raw.serving_quantity),
  };
}

/** Brauchbar heisst: hat einen Namen und wenigstens die Kalorien. */
const usable = (product: FoodProduct): boolean =>
  product.name !== 'Unbenanntes Produkt' && product.kcal100 != null;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function lookupProduct(barcode: string): Promise<FoodProduct | null> {
  const code = barcode.trim();
  if (!isBarcode(code)) return null;

  const payload = await getJson(`${WORLD}/api/v2/product/${code}.json?fields=${FIELDS}`) as
    { status?: number; product?: RawProduct } | null;
  if (!payload || payload.status !== 1 || !payload.product) return null;
  return toProduct(payload.product, code);
}

/**
 * Sucht Lebensmittel ueber einen Begriff. Zuerst der Volltextdienst, dann die
 * CGI-Suche der deutschen und der weltweiten Instanz - je nachdem, was zuerst
 * genug Treffer bringt.
 */
export async function searchProducts(query: string): Promise<FoodProduct[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  let results = await fromSearchService(term);
  if (results.length < 5) {
    const merged = new Map(results.map((product) => [product.barcode || product.name, product]));
    for (const product of await fromCgi(GERMANY, term)) {
      merged.set(product.barcode || product.name, product);
    }
    results = [...merged.values()];
  }
  if (results.length < 5) {
    const merged = new Map(results.map((product) => [product.barcode || product.name, product]));
    for (const product of await fromCgi(WORLD, term)) {
      merged.set(product.barcode || product.name, product);
    }
    results = [...merged.values()];
  }

  return dedupe(results).slice(0, 20);
}

/** Volltextsuche von Open Food Facts - typo-tolerant, nach Bekanntheit sortiert. */
async function fromSearchService(term: string): Promise<FoodProduct[]> {
  const url = `${SEARCH}/search?q=${encodeURIComponent(term)}`
    + `&langs=de,en&sort_by=-unique_scans_n&page_size=40&fields=${FIELDS}`;
  const payload = await getJson(url) as { hits?: RawProduct[] } | null;
  return (payload?.hits ?? []).map((raw) => toProduct(raw)).filter(usable);
}

/** Klassische CGI-Suche einer Instanz (de. oder world.). */
async function fromCgi(host: string, term: string): Promise<FoodProduct[]> {
  const url = `${host}/cgi/search.pl?search_terms=${encodeURIComponent(term)}`
    + `&search_simple=1&action=process&json=1&page_size=40&sort_by=unique_scans_n&fields=${FIELDS}`;
  const payload = await getJson(url) as { products?: RawProduct[] } | null;
  return (payload?.products ?? []).map((raw) => toProduct(raw)).filter(usable);
}

function dedupe(products: FoodProduct[]): FoodProduct[] {
  const seen = new Set<string>();
  const out: FoodProduct[] = [];
  for (const product of products) {
    const key = `${product.name}|${product.brand}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  // Eintraege mit vollstaendigen Makros zuerst - die kann man ohne Nachtragen benutzen.
  return out.sort((a, b) => complete(b) - complete(a));
}

const complete = (product: FoodProduct): number =>
  Number(product.protein100 != null) + Number(product.carbs100 != null) + Number(product.fat100 != null);

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
