// Seeds are sold in packs — the stored price/quantity are per pack of SEEDS_PER_PACK seeds.
// Only the price label changes; cart, checkout and stock logic use the price as-is.
export const SEEDS_PER_PACK = 50;

export function isSeedsCategory(categoryName: string | null | undefined): boolean {
  return categoryName?.trim().toLowerCase() === 'seeds';
}

/** Suffix shown next to a Seeds price, e.g. "(per 50 seeds)" */
export const SEEDS_PRICE_SUFFIX = `(per ${SEEDS_PER_PACK} seeds)`;
