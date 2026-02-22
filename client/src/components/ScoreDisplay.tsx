import { getScoreColor, getScoreBgColor } from "@/lib/constants";

interface ScoreDisplayProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ScoreDisplay({ score, size = "md", showLabel = false }: ScoreDisplayProps) {
  const displayScore = score ?? 0;
  const rounded = Math.round(displayScore);

  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-14 h-14 text-lg",
    lg: "w-20 h-20 text-2xl",
  };

  return (
    <div className="flex flex-col items-center gap-1" data-testid="score-display">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold ${getScoreColor(displayScore)} bg-background border-2 ${displayScore >= 70 ? "border-emerald-200 dark:border-emerald-800" : displayScore >= 40 ? "border-amber-200 dark:border-amber-800" : "border-red-200 dark:border-red-800"}`}
      >
        {rounded}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground font-medium">Score</span>
      )}
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore?: number;
}

export function ScoreBar({ label, score, maxScore = 10 }: ScoreBarProps) {
  const percentage = (score / maxScore) * 100;

  return (
    <div className="space-y-1" data-testid={`score-bar-${label}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={`text-sm font-bold ${getScoreColor(score * 10)}`}>
          {score.toFixed(1)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(score * 10)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
