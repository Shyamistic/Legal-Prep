import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brass-400 text-ink-950 hover:bg-brass-300 disabled:bg-ink-600 disabled:text-parchment-400",
  secondary:
    "bg-ink-700 text-parchment-50 hover:bg-ink-600 border border-ink-500 disabled:opacity-50",
  ghost: "bg-transparent text-parchment-100 hover:bg-ink-700 disabled:opacity-50",
  danger: "bg-red-900/60 text-red-100 hover:bg-red-800/70 border border-red-700/50",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base py-3.5",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export function linkButtonClasses(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    variants[variant],
    sizes[size],
    extra,
  );
}
