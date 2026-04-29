/** True if `zone` is accepted as an IANA timezone by this runtime (`Intl`). */
export function isValidIanaTimezone(zone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
