import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type SidePanelContextValue = {
  panelWidth: number
}

const SidePanelContext = React.createContext<SidePanelContextValue | null>(null)

function SidePanel({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="side-panel" {...props} />
}

function SidePanelTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="side-panel-trigger" {...props} />
}

function SidePanelPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="side-panel-portal" {...props} />
}

function SidePanelClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="side-panel-close" {...props} />
}

function SidePanelOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="side-panel-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-300 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

interface SidePanelContentProps extends DialogPrimitive.Popup.Props {
  panelWidth?: number
}

function SidePanelContent({
  className,
  children,
  panelWidth = 480,
  ...props
}: SidePanelContentProps) {
  const contextValue = React.useMemo<SidePanelContextValue>(
    () => ({ panelWidth }),
    [panelWidth]
  )

  return (
    <SidePanelPortal>
      <SidePanelOverlay />
      <SidePanelContext.Provider value={contextValue}>
        <DialogPrimitive.Popup
          data-slot="side-panel-content"
          style={
            {
              "--panel-width": `${panelWidth}px`,
            } as React.CSSProperties
          }
          className={cn(
            "fixed top-0 right-0 z-50 flex h-full w-[var(--panel-width)] flex-col bg-[var(--lc-bg-primary)] border-l border-[var(--lc-border)] shadow-[-4px_0_24px_rgba(0,0,0,0.1)] duration-300 outline-none data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
            className
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Popup>
      </SidePanelContext.Provider>
    </SidePanelPortal>
  )
}

function SidePanelHeader({
  className,
  children,
  closeLabel = "Close",
  ...props
}: React.ComponentProps<"div"> & {
  closeLabel?: string
}) {
  return (
    <div
      data-slot="side-panel-header"
      className={cn("flex h-14 shrink-0 items-center justify-between border-b border-[var(--lc-border)] px-6", className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        data-slot="side-panel-close"
        className="flex size-8 items-center justify-center rounded-md text-[var(--lc-text-secondary)] transition-colors hover:bg-[var(--lc-bg-secondary)] hover:text-[var(--lc-text-primary)]"
      >
        <X className="size-[18px]" />
        <span className="sr-only">{closeLabel}</span>
      </DialogPrimitive.Close>
    </div>
  )
}

function SidePanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-footer"
      className={cn(
        "flex shrink-0 items-center justify-end gap-3 border-t border-[var(--lc-border)] px-6 py-4",
        className
      )}
      {...props}
    />
  )
}

function SidePanelTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="side-panel-title"
      className={cn("text-base font-semibold text-[var(--lc-text-primary)]", className)}
      {...props}
    />
  )
}

function SidePanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="side-panel-body"
      className={cn("flex-1 overflow-y-auto px-6 py-6", className)}
      {...props}
    />
  )
}

export {
  SidePanel,
  SidePanelClose,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelOverlay,
  SidePanelPortal,
  SidePanelTitle,
  SidePanelTrigger,
  SidePanelBody,
}
