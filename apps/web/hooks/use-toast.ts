import { toast as sonnerToast } from "sonner";
import type { ExternalToast } from "sonner";

export function useToast() {
  return {
    toast: ({
      title,
      description,
      variant,
      position,
      action,
    }: {
      title?: string;
      description?: string;
      variant?: "default" | "destructive";
      position?: ExternalToast["position"];
      action?: ExternalToast["action"];
    }) => {
      const options: ExternalToast = {
        description,
        position,
        action,
      };

      if (variant === "destructive") {
        sonnerToast.error(title, options);
      } else {
        sonnerToast.success(title, options);
      }
    },
  };
}
