/** App-side sentinel only — never send this to Paddle as a country code. */
export const UNKNOWN_COUNTRY = "OTHERS";

export function resolveCountryFromHeaders(
  countryHeader: string | null,
): string {
  if (!countryHeader || countryHeader === "XX" || countryHeader === "T1") {
    return UNKNOWN_COUNTRY;
  }
  return countryHeader.toUpperCase();
}
