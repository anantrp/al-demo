import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const itemVariants = {
  default: "bg-transparent",
  outline: "rounded-lg border bg-card",
  muted: "rounded-lg bg-muted/50",
};

const itemSizes = {
  default: "gap-3 px-4 py-3",
  sm: "gap-2 px-3 py-2",
  xs: "gap-1.5 px-2 py-1.5",
};

interface ItemProps extends React.ComponentPropsWithoutRef<"div"> {
  variant?: keyof typeof itemVariants;
  size?: keyof typeof itemSizes;
  asChild?: boolean;
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  ({ className, variant = "default", size = "default", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "div";
    return (
      <Comp
        ref={ref}
        data-slot="item"
        className={cn(
          "flex w-full items-center text-left",
          itemVariants[variant],
          itemSizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Item.displayName = "Item";

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-group" className={cn("flex flex-col gap-1", className)} {...props} />;
}

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "icon" | "image" }) {
  return (
    <div
      data-slot="item-media"
      className={cn(
        "flex shrink-0 items-center justify-center",
        variant === "icon" && "size-9 rounded-md bg-muted",
        variant === "image" && "overflow-hidden rounded-md",
        className
      )}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-content" className={cn("min-w-0 flex-1", className)} {...props} />;
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="item-title" className={cn("font-medium leading-none", className)} {...props} />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-description"
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

export { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions };
