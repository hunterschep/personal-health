import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-ink text-sm font-semibold", className)} {...props} />;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "border-line-strong bg-surface-raised text-ink placeholder:text-ink-soft/60 focus:border-brand min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base shadow-sm outline-none sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TextInput(props: Omit<InputProps, "type">) {
  return <Input type="text" {...props} />;
}

export function EmailInput(props: Omit<InputProps, "type">) {
  return <Input type="email" inputMode="email" {...props} />;
}

export function PasswordInput(props: Omit<InputProps, "type">) {
  return <Input type="password" {...props} />;
}

export function DateInput(props: Omit<InputProps, "type">) {
  return <Input type="date" {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "border-line-strong bg-surface-raised text-ink focus:border-brand min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-base shadow-sm outline-none sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "border-line-strong bg-surface-raised text-ink placeholder:text-ink-soft/60 focus:border-brand min-h-28 w-full resize-y rounded-xl border px-3.5 py-3 text-base shadow-sm outline-none sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

type DescribedControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
};

export function FormField({ id, label, hint, error, children }: FieldProps) {
  const descriptionId =
    error === undefined ? (hint === undefined ? undefined : `${id}-hint`) : `${id}-error`;
  const childArray = Children.toArray(children);
  const controlIndex = childArray.findIndex((child) =>
    isValidElement<DescribedControlProps>(child),
  );
  const controls = childArray.map((child, index) => {
    if (index !== controlIndex || !isValidElement<DescribedControlProps>(child)) return child;
    const describedBy = [child.props["aria-describedby"], descriptionId]
      .filter((value): value is string => value !== undefined && value.length > 0)
      .join(" ");
    return cloneElement(child, {
      id: child.props.id ?? id,
      ...(describedBy.length === 0 ? {} : { "aria-describedby": describedBy }),
      ...(error === undefined ? {} : { "aria-invalid": true }),
    });
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {controls}
      {hint !== undefined && error === undefined ? (
        <p id={`${id}-hint`} className="text-ink-soft text-xs leading-5">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={`${id}-error`} role="alert" className="text-rose text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" tabIndex={-1} className="border-rose/30 bg-rose-soft rounded-xl border p-4">
      <p className="text-rose font-semibold">Please review the following:</p>
      <ul className="text-ink mt-2 list-disc space-y-1 pl-5 text-sm">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
