import { Shield } from "lucide-react";
import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Aegis home">
      <span className="brand-icon">
        <Shield strokeWidth={3} size={24} />
      </span>
      AEGIS
    </Link>
  );
}
