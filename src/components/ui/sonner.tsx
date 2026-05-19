"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] text-[var(--lc-text-primary)] shadow-lg",
          description: "text-[var(--lc-text-secondary)]",
          actionButton: "bg-[var(--lc-accent)] text-white",
          cancelButton: "bg-[var(--lc-bg-secondary)] text-[var(--lc-text-primary)]"
        }
      }}
      {...props}
    />
  );
}

export { Toaster };
