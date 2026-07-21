import { LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PrivacyIndicator({ label = "Private profile" }: { label?: string }) {
  return (
    <Badge tone="brand">
      <LockKeyhole aria-hidden="true" />
      {label}
    </Badge>
  );
}
