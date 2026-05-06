/**
 * Removes legacy `camp.price` from JSON payloads. All charge amounts come from `CampTier.price`.
 * The `Camp.price` column may still exist for historical rows; public and admin mutation APIs must not treat it as authoritative pricing.
 */
export function stripLegacyCampPrice<C extends { price?: number | null }>(
  camp: C
): Omit<C, 'price'> {
  const { price: _legacyCampPrice, ...rest } = camp;
  return rest;
}
