const MAX_U128 = (1n << 128n) - 1n;
export function units(input: string, decimals = 6): bigint {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(input))
    throw new Error(
      "Enter a plain positive decimal, without exponent or separators.",
    );
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals)
    throw new Error(`Maximum ${decimals} decimal places.`);
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (result > MAX_U128)
    throw new Error("Amount exceeds supported integer range.");
  return result;
}
export function display(value: string | bigint, decimals = 6): string {
  const amount = BigInt(value),
    scale = 10n ** BigInt(decimals);
  const fraction = (amount % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${amount / scale}${fraction ? "." + fraction : ""}`;
}
export function positive(input: string, decimals = 6): string {
  const n = units(input, decimals);
  if (n === 0n) throw new Error("Amount must be greater than zero.");
  return n.toString();
}
