export function isExhaustOn(bathrooms: Array<{ luz?: boolean }> = []): boolean {
  return bathrooms.some((bathroom) => bathroom?.luz === true);
}

export function calculateExhaustState(bathrooms: Array<{ luz?: boolean }> = []): { ligada: boolean; logica: "OR" } {
  return { ligada: isExhaustOn(bathrooms), logica: "OR" };
}
