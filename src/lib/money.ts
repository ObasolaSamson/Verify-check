export function formatNairaFromKobo(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

export function turnaroundLabel(minDays: number, maxDays: number) {
  return `${minDays}–${maxDays} working days`;
}
