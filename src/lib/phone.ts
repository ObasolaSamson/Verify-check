/** Nigerian numbers stored as E.164, for example +2348012345678. */
export function normalizePhone(input: string) {
  const trimmed = input.trim().replace(/[\s()-]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("234")) return `+${trimmed}`;
  if (trimmed.startsWith("0") && trimmed.length === 11) return `+234${trimmed.slice(1)}`;
  return trimmed;
}

export function isNigerianPhone(phone: string) {
  return /^\+234\d{10}$/.test(phone);
}

export function maskPhone(phone: string) {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)}••••${phone.slice(-4)}`;
}
