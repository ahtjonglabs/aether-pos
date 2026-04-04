"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"

// Dialog components (desktop)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Sheet components (mobile bottom sheet)
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { cn } from "@/lib/utils"

// ============================================================
// Root — transparent wrapper
// ============================================================
function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {children}
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

// ============================================================
// Content — Sheet (bottom) on mobile, Dialog (center) on desktop
// ============================================================
function ResponsiveDialogContent({
  className,
  children,
  desktopClassName,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  desktopClassName?: string
} & React.ComponentProps<typeof SheetContent> & {
  showCloseButton?: boolean
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        className={cn(
          "bg-zinc-900 border-zinc-800 rounded-t-2xl max-h-[85vh] overflow-y-auto p-0",
          className
        )}
        {...props}
      >
        {children}
      </SheetContent>
    )
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      className={cn("bg-zinc-900 border-zinc-800 rounded-xl", desktopClassName || className)}
      {...props}
    >
      {children}
    </DialogContent>
  )
}

// ============================================================
// Header — SheetHeader / DialogHeader
// ============================================================
function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader> & React.ComponentProps<typeof SheetHeader>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <SheetHeader
        className={cn("px-5 pt-5 pb-2", className)}
        {...props}
      />
    )
  }

  return <DialogHeader className={className} {...props} />
}

// ============================================================
// Title — SheetTitle / DialogTitle
// ============================================================
function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle> & React.ComponentProps<typeof SheetTitle>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <SheetTitle className={cn("text-zinc-100 text-sm font-semibold", className)} {...props} />
  }

  return <DialogTitle className={className} {...props} />
}

// ============================================================
// Description — SheetDescription / DialogDescription
// ============================================================
function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription> &
  React.ComponentProps<typeof SheetDescription>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <SheetDescription className={cn("text-zinc-400 text-xs", className)} {...props} />
    )
  }

  return <DialogDescription className={className} {...props} />
}

// ============================================================
// Footer — SheetFooter / DialogFooter
// ============================================================
function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter> & React.ComponentProps<typeof SheetFooter>) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <SheetFooter
        className={cn(
          "px-5 pb-5 pt-3 border-t border-zinc-800/60 flex-row gap-2",
          className
        )}
        {...props}
      />
    )
  }

  return <DialogFooter className={className} {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
}
