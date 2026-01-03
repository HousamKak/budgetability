import { summaryCardStyles } from "@/styles/components/summary-card";
import { cn, variant, conditional } from "@/styles";
import { formatNumber } from "@/lib/utils";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Info } from "./Icons";

interface SummaryCardProps {
  title: string;
  value: number;
  highlight?: boolean;
  red?: boolean;
  blue?: boolean;
  leftAmount?: number;
  leftLabel?: string;
  leftAmountRed?: boolean;
  titleTooltip?: string;
  leftLabelTooltip?: string;
}

export function SummaryCard({ title, value, highlight = false, red = false, blue = false, leftAmount, leftLabel, leftAmountRed = false, titleTooltip, leftLabelTooltip }: SummaryCardProps) {
  const cardVariant = highlight ? 'highlight' : red ? 'red' : blue ? 'blue' : 'default';

  return (
    <div className={cn(
      summaryCardStyles.base,
      variant(cardVariant, summaryCardStyles.variants),
      "flex items-center justify-center"
    )}>
      <div className="grid grid-cols-2 gap-1 place-items-center">
        {/* Left section */}
        <div className="flex flex-col items-center text-center">
          {/* Upper left: Main label */}
          <div className="flex items-center gap-1 mb-0.5">
            <div className={summaryCardStyles.title}>{title}</div>
            {titleTooltip && (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <button className="opacity-50 hover:opacity-100 transition-opacity">
                    <Info className="w-3 h-3" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-48 text-xs">
                  {titleTooltip}
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
          {/* Lower left: Main amount */}
          <div
            className={cn(
              summaryCardStyles.value,
              conditional(red, summaryCardStyles.valueRed),
              conditional(blue, 'text-blue-600')
            )}
            style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", cursive' }}
          >
            ${formatNumber(value || 0)}
          </div>
        </div>

        {/* Right section */}
        {leftAmount !== undefined && leftLabel && (
          <div className="flex flex-col items-center text-center hidden lg:flex">
            {/* Upper right: Right label */}
            <div className="flex items-center gap-1 mb-0.5">
              <div className="text-xs opacity-60 font-medium">{leftLabel}</div>
              {leftLabelTooltip && (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <button className="opacity-30 hover:opacity-80 transition-opacity">
                      <Info className="w-2.5 h-2.5" />
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-48 text-xs">
                    {leftLabelTooltip}
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
            {/* Lower right: Right amount */}
            <div
              className={cn(
                "text-lg font-bold tracking-wide",
                leftAmountRed ? "text-red-600" : "text-emerald-600"
              )}
              style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", cursive' }}
            >
              ${formatNumber(leftAmount || 0)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}