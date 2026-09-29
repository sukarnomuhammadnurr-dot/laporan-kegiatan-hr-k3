import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={lihat ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
      >
        {lihat ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </div>
  );
}
