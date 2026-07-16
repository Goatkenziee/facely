import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantStyles = {
  default: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
  destructive: "bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25",
  outline: "border border-white/10 bg-transparent hover:bg-white/5 text-slate-300",
  ghost: "bg-transparent hover:bg-white/5 text-slate-400",
  link: "bg-transparent underline-offset-4 hover:underline text-emerald-400",
};

const sizeStyles = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-10 px-6 text-base",
  icon: "h-9 w-9",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
