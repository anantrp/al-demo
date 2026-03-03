"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaNamespace } from "radix-ui";
import { cn } from "@/lib/utils";

const ScrollAreaPrimitive = ScrollAreaNamespace.Root;
const ScrollAreaViewport = ScrollAreaNamespace.Viewport;
const ScrollAreaScrollbar = ScrollAreaNamespace.Scrollbar;
const ScrollAreaThumb = ScrollAreaNamespace.Thumb;

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaViewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaViewport>
    <ScrollAreaScrollbar
      orientation="vertical"
      className="flex touch-none select-none transition-colors"
    >
      <ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaScrollbar>
  </ScrollAreaPrimitive>
));

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-px",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
      className
    )}
    {...props}
  >
    <ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaScrollbar>
));

ScrollArea.displayName = "ScrollArea";
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
