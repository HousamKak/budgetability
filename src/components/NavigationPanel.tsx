import { Home, BarChart3, PiggyBank, Wallet, Table2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { paperTheme } from "@/styles";

/**
 * Small navigation panel toolkit on the left side of the screen
 * Contains navigation buttons for different views
 */
export function NavigationPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === "/";
  const isAccounts = location.pathname === "/accounts";
  const isSavings = location.pathname === "/savings";
  const isAnalytics = location.pathname === "/analytics";
  const isSpreadsheet = location.pathname === "/spreadsheet";

  return (
    <div className="fixed left-1 top-1/2 -translate-y-1/2 z-40">
      {/* Main panel container with paper theme styling */}
      <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-3 ${paperTheme.effects.shadow.md} overflow-hidden`}>
        {/* Paper texture overlay */}
        <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>

        {/* Yellow tape effect at top */}
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 ${paperTheme.effects.yellowTape}`}></div>

        {/* Button container */}
        <div className="relative z-10 flex flex-col gap-2">
          {/* Home Button */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                onClick={() => navigate("/")}
                variant="ghost"
                size="sm"
                className={`
                  relative w-10 h-10 ${paperTheme.radius.md} transition-all duration-200 cursor-pointer flex items-center justify-center
                  ${isHome
                    ? `${paperTheme.colors.background.white} ${paperTheme.effects.shadow.sm} ${paperTheme.colors.borders.amberStrong} ${paperTheme.colors.text.accent}`
                    : `${paperTheme.colors.background.whiteTransparent} hover:${paperTheme.colors.background.white} ${paperTheme.colors.borders.amber} ${paperTheme.colors.text.muted} hover:${paperTheme.colors.text.accent}`
                  }
                `}
                aria-label="Home"
              >
                {/* Subtle paper texture for button */}
                <div className={`absolute inset-0 opacity-10 ${paperTheme.effects.paperTextureSmall} ${paperTheme.radius.md}`}></div>
                <Home className="w-4 h-4 relative z-10" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent side="right" className="w-auto text-xs">
              Home
            </HoverCardContent>
          </HoverCard>

          {/* Accounts Button */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                onClick={() => navigate("/accounts")}
                variant="ghost"
                size="sm"
                className={`
                  relative w-10 h-10 ${paperTheme.radius.md} transition-all duration-200 cursor-pointer flex items-center justify-center
                  ${isAccounts
                    ? `${paperTheme.colors.background.white} ${paperTheme.effects.shadow.sm} ${paperTheme.colors.borders.amberStrong} ${paperTheme.colors.text.accent}`
                    : `${paperTheme.colors.background.whiteTransparent} hover:${paperTheme.colors.background.white} ${paperTheme.colors.borders.amber} ${paperTheme.colors.text.muted} hover:${paperTheme.colors.text.accent}`
                  }
                `}
                aria-label="Accounts"
              >
                {/* Subtle paper texture for button */}
                <div className={`absolute inset-0 opacity-10 ${paperTheme.effects.paperTextureSmall} ${paperTheme.radius.md}`}></div>
                <Wallet className="w-4 h-4 relative z-10" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent side="right" className="w-auto text-xs">
              Accounts
            </HoverCardContent>
          </HoverCard>

          {/* Savings & Goals Button */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                onClick={() => navigate("/savings")}
                variant="ghost"
                size="sm"
                className={`
                  relative w-10 h-10 ${paperTheme.radius.md} transition-all duration-200 cursor-pointer flex items-center justify-center
                  ${isSavings
                    ? `${paperTheme.colors.background.white} ${paperTheme.effects.shadow.sm} ${paperTheme.colors.borders.amberStrong} ${paperTheme.colors.text.accent}`
                    : `${paperTheme.colors.background.whiteTransparent} hover:${paperTheme.colors.background.white} ${paperTheme.colors.borders.amber} ${paperTheme.colors.text.muted} hover:${paperTheme.colors.text.accent}`
                  }
                `}
                aria-label="Savings & Goals"
              >
                {/* Subtle paper texture for button */}
                <div className={`absolute inset-0 opacity-10 ${paperTheme.effects.paperTextureSmall} ${paperTheme.radius.md}`}></div>
                <PiggyBank className="w-4 h-4 relative z-10" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent side="right" className="w-auto text-xs">
              Savings & Goals
            </HoverCardContent>
          </HoverCard>

          {/* Analytics Button */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                onClick={() => navigate("/analytics")}
                variant="ghost"
                size="sm"
                className={`
                  relative w-10 h-10 ${paperTheme.radius.md} transition-all duration-200 cursor-pointer flex items-center justify-center
                  ${isAnalytics
                    ? `${paperTheme.colors.background.white} ${paperTheme.effects.shadow.sm} ${paperTheme.colors.borders.amberStrong} ${paperTheme.colors.text.accent}`
                    : `${paperTheme.colors.background.whiteTransparent} hover:${paperTheme.colors.background.white} ${paperTheme.colors.borders.amber} ${paperTheme.colors.text.muted} hover:${paperTheme.colors.text.accent}`
                  }
                `}
                aria-label="Analytics"
              >
                {/* Subtle paper texture for button */}
                <div className={`absolute inset-0 opacity-10 ${paperTheme.effects.paperTextureSmall} ${paperTheme.radius.md}`}></div>
                <BarChart3 className="w-4 h-4 relative z-10" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent side="right" className="w-auto text-xs">
              Analytics
            </HoverCardContent>
          </HoverCard>

          {/* Spreadsheet Button */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                onClick={() => navigate("/spreadsheet")}
                variant="ghost"
                size="sm"
                className={`
                  relative w-10 h-10 ${paperTheme.radius.md} transition-all duration-200 cursor-pointer flex items-center justify-center
                  ${isSpreadsheet
                    ? `${paperTheme.colors.background.white} ${paperTheme.effects.shadow.sm} ${paperTheme.colors.borders.amberStrong} ${paperTheme.colors.text.accent}`
                    : `${paperTheme.colors.background.whiteTransparent} hover:${paperTheme.colors.background.white} ${paperTheme.colors.borders.amber} ${paperTheme.colors.text.muted} hover:${paperTheme.colors.text.accent}`
                  }
                `}
                aria-label="Spreadsheet"
              >
                <div className={`absolute inset-0 opacity-10 ${paperTheme.effects.paperTextureSmall} ${paperTheme.radius.md}`}></div>
                <Table2 className="w-4 h-4 relative z-10" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent side="right" className="w-auto text-xs">
              Spreadsheet
            </HoverCardContent>
          </HoverCard>
        </div>
      </div>
    </div>
  );
}