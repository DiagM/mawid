import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-navy text-beige shadow-lg shadow-navy/20 hover:bg-navy-light",
  secondary:
    "bg-sand text-navy shadow-md shadow-sand/30 hover:bg-sand-light",
  ghost: "bg-transparent text-navy border border-navy/15 hover:bg-navy/5",
  danger: "bg-danger text-beige shadow-md shadow-danger/20 hover:opacity-90",
};

const SIZE = "px-6 py-3.5 text-base";

/**
 * Classes partagées, exportées pour pouvoir styler un <a> exactement comme
 * un <button> (ex: le lien wa.me de confirmation, qui doit s'ouvrir dans un
 * nouvel onglet et ne peut donc pas être un vrai <button>).
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  fullWidth = true,
): string {
  return [BASE, VARIANTS[variant], SIZE, fullWidth ? "w-full" : ""].join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  fullWidth = true,
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${buttonClasses(variant, fullWidth)} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-5 w-5" />}
      {children}
    </button>
  );
}
