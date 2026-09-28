import { cn } from "@/lib/utils";
import { STATUS_CLASS, STATUS_LABEL, type ReportStatus } from "@/lib/status";

export function StatusBadge({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
