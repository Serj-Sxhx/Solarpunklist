import { STAGE_CONFIG } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

interface StageBadgeProps {
  stage: string | null | undefined;
  size?: "sm" | "default";
}

export function StageBadge({ stage, size = "default" }: StageBadgeProps) {
  const config = stage && stage in STAGE_CONFIG
    ? STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG]
    : STAGE_CONFIG.established;

  return (
    <Badge
      variant="outline"
      className={`${config.color} border-0 font-semibold ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"}`}
      data-testid={`badge-stage-${stage}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${config.dotColor} mr-1.5`} />
      {config.label}
    </Badge>
  );
}
