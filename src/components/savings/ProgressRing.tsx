import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Circular progress indicator for savings goals
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#f59e0b",
  backgroundColor = "#e5e7eb",
  className,
  children,
}: ProgressRingProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center content */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Linear progress bar alternative
 */
export function ProgressBar({
  progress,
  height = 8,
  color = "#f59e0b",
  backgroundColor = "#e5e7eb",
  className,
  showLabel = false,
}: {
  progress: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("w-full", className)}>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, backgroundColor }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${normalizedProgress}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-stone-500 mt-1 text-right">
          {normalizedProgress.toFixed(0)}%
        </p>
      )}
    </div>
  );
}

export default ProgressRing;
