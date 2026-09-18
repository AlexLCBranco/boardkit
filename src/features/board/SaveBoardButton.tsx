import { DownloadIcon, FileImageIcon, FileTextIcon, LoaderIcon } from "lucide-react";
import { useState, type ComponentType } from "react";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { useActiveBoardName } from "../../store/selectors";
import { saveBoardAsPdf, saveBoardAsPng } from "./saveBoard";

interface SaveBoardButtonProps {
  readonly railRef: React.RefObject<HTMLElement | null>;
}

type Format = "png" | "pdf";

const OPTIONS: readonly {
  readonly format: Format;
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly Icon: ComponentType;
}[] = [
  {
    format: "png",
    title: "Image",
    description: "The whole board as one picture, every list side by side.",
    action: "Save as PNG",
    Icon: FileImageIcon,
  },
  {
    format: "pdf",
    title: "PDF",
    description: "The same full-board picture as a single-page PDF, ready to send or print.",
    action: "Save as PDF",
    Icon: FileTextIcon,
  },
];

/**
 * A toolbar button that opens a "Save to…" dialog. Each option downloads the
 * whole board as a file, so it can be kept or sent on without the app.
 */
export function SaveBoardButton({ railRef }: SaveBoardButtonProps) {
  const boardName = useActiveBoardName();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<Format | null>(null);
  const [error, setError] = useState(false);

  async function handleSave(format: Format) {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    setSaving(format);
    setError(false);
    try {
      await (format === "png" ? saveBoardAsPng : saveBoardAsPdf)(rail, boardName);
      setOpen(false);
    } catch (failure) {
      console.error(`save board as ${format} failed`, failure);
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Save board" title="Save board">
          <DownloadIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Save to…</DialogTitle>
          <DialogDescription>Downloads “{boardName}” to your computer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(({ format, title, description, action, Icon }) => (
            <div key={format} className="flex flex-col items-center gap-3 rounded-lg p-4 text-center ring-1 ring-foreground/10">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground [&>svg]:size-6">
                <Icon />
              </span>
              <h3 className="text-base font-medium">{title}</h3>
              <p className="flex-1 text-sm text-muted-foreground">{description}</p>
              <Button type="button" disabled={saving !== null} onClick={() => handleSave(format)}>
                {saving === format ? <LoaderIcon className="animate-spin" /> : null}
                {action}
              </Button>
            </div>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn’t save the board. A very large board can exceed the browser’s image size limit.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
