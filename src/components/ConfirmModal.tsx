import { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-surface border border-border rounded-lg p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className="font-serif text-2xl font-semibold text-ink"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm text-ink-muted leading-relaxed">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 min-h-[44px] rounded-md border border-border bg-surface text-sm font-medium text-ink hover:bg-subtle transition-colors whitespace-nowrap cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 min-h-[44px] rounded-md text-sm font-semibold text-white transition-colors whitespace-nowrap cursor-pointer ${
              destructive
                ? 'bg-rubric hover:bg-rubric-hover'
                : 'bg-ink hover:bg-ink/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
