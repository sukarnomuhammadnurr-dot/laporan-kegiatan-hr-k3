import { inisialNama, useStorageUrl } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function TrainerAvatar({
  nama,
  foto,
  className,
}: {
  nama: string | null | undefined;
  foto?: string | null;
  className?: string;
}) {
  const url = useStorageUrl(foto);
  return (
    <div
      className={cn(
        "num grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-2 ring-card",
        className,
      )}
    >
      {url ? <img src={url} alt={nama ?? "Trainer"} className="size-full object-cover" /> : inisialNama(nama)}
    </div>
  );
}
