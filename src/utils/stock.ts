// Shared stock rule so the cards and the detail page always agree.
// `quantity` is missing only if the API is out of date — don't claim Sold Out on a guess.
export function isSoldOut(quantity: number | undefined): boolean {
  return quantity !== undefined && quantity <= 0;
}
