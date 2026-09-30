import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TIPE_GAMBAR, useStorageUrl } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * Pilih → preview → Batal / Simpan. Hapus mengosongkan nilai.
 * `onSave` menerima File baru; `onRemove` untuk menghapus gambar aktif.
 */
export function ImageUploadField({
  label,
  hint,
  path,
  onSave,
  onRemove,
  aspect = "aspect-video",
  round,
}: {
  label: string;
  hint?: string;
  path: string | null | undefined;
  onSave: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  aspect?: string;
  round?: boolean;
}) {
  const current = useStorageUrl(path);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pilih(f: File | undefined) {
    setErr(null);
    if (!f) return;
    if (!TIPE_GAMBAR.includes(f.type)) return setErr("Format harus JPG, JPEG, PNG, atau WEBP.");
    if (f.size > 5 * 1024 * 1024) return setErr("Ukuran maksimal 5 MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function batal() {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  }

  async function jalankan(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      batal();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const tampil = preview ?? current;

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden border border-dashed border-border bg-accent/40",
          round ? "size-28 rounded-full" : cn(aspect, "w-full rounded-xl"),
        )}
      >
        {tampil ? (
          <img src={tampil} alt={label} className={cn("size-full", round ? "object-cover" : "object-contain")} />
        ) : (
          <ImagePlus className="size-7 text-muted-foreground" />
        )}
        {preview && (
          <span className="eyebrow absolute top-2 left-2 rounded-full bg-status-waiting px-2 py-1 text-primary-foreground">
            Preview
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => pilih(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        {file ? (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={() => jalankan(() => onSave(file))}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={batal}>
              Batal
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
              {path ? "Ganti" : "Upload"}
            </Button>
            {path && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                className="text-destructive"
                onClick={() => window.confirm(`Hapus ${label.toLowerCase()}?`) && jalankan(onRemove)}
              >
                <Trash2 className="size-4" /> Hapus
              </Button>
            )}
          </>
        )}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
