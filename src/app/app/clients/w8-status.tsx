import { daysUntil } from "@/lib/tax/dates";
import { Badge } from "../ui";

/** Badge for the most recent W-8 on file for a client. */
export function W8Status({ latest }: { latest: { form_type: string; expires_on: string } | null }) {
  if (!latest) return <Badge tone="red">No W-8 on file</Badge>;
  const d = daysUntil(latest.expires_on);
  if (d < 0) return <Badge tone="red">{latest.form_type} expired</Badge>;
  if (d <= 90) return <Badge tone="amber">{latest.form_type} expires in {d} days</Badge>;
  return <Badge tone="green">{latest.form_type} valid to {latest.expires_on}</Badge>;
}
