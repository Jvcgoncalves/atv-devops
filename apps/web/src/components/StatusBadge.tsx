import { statusLabel } from "../theme.ts";
import type { StatusBadgeProps } from "../types/ui.ts";

// Badge de status. Nunca depende SO da cor (acessibilidade): traz sempre rotulo.
export default function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge badge--${status}`}>{statusLabel[status]}</span>;
}
