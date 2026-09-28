import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "verified" | "revision" | "review" | "sent";
}) {
  const toneClass = {
    default: "text-foreground",
    verified: "text-status-verified",
    revision: "text-status-revision",
    review: "text-status-review",
    sent: "text-status-sent",
  }[tone];

  return (
    <div className="glass-tile rounded-xl p-3.5 ring-1 ring-foreground/5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-2xl leading-none font-semibold", toneClass)}>{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
