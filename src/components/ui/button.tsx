import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold tracking-[-0.01em] transition duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-brand bg-brand text-white shadow-[0_8px_24px_rgb(var(--shadow)/0.14)] hover:-translate-y-0.5 hover:bg-brand-strong",
        secondary:
          "border-line-strong bg-surface-raised text-ink hover:border-brand hover:bg-brand-soft",
        ghost:
          "border-transparent bg-transparent text-ink-soft hover:bg-surface-muted hover:text-ink",
        quiet: "border-transparent bg-brand-soft text-brand-strong hover:bg-brand hover:text-white",
        destructive: "border-rose bg-rose text-white hover:brightness-90",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "min-h-11 px-3.5 py-1.5 text-xs",
        lg: "min-h-12 px-6 py-3 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

type IconButtonProps = Omit<ButtonProps, "aria-label" | "children" | "size"> & {
  "aria-label": string;
  children: ReactNode;
};

/** Icon-only action with a compile-time required accessible name. */
export function IconButton({ asChild = false, type = "button", ...props }: IconButtonProps) {
  return <Button asChild={asChild} size="icon" type={asChild ? undefined : type} {...props} />;
}

export { buttonVariants };
