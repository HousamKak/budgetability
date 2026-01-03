import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dialogStyles } from "@/styles";

interface QuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: string;
}

export function QuoteModal({ open, onOpenChange, quote }: QuoteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md mx-2 sm:mx-auto"
        aria-describedby={undefined}
      >
        <div className={dialogStyles.paperDialog}>
          {/* Paper texture overlay */}
          <div className={dialogStyles.paperTexture}></div>

          {/* Yellow transparent tape */}
          <div className={dialogStyles.yellowTape}></div>

          {/* Torn edge effect */}
          <div className={dialogStyles.tornEdge}></div>

          <div className={`${dialogStyles.contentWrapper} text-center`}>
            <div className="text-4xl mb-4">✨</div>

            <DialogHeader className="mb-4">
              <DialogTitle
                className="text-xl font-bold text-stone-700"
                style={{
                  fontFamily: '"Patrick Hand", "Comic Sans MS", cursive',
                }}
              >
                Quote of the Day
              </DialogTitle>
            </DialogHeader>

            <div className={dialogStyles.formSection}>
              <p
                className="text-stone-700 text-lg leading-relaxed font-medium"
                style={{
                  fontFamily: '"Patrick Hand", "Comic Sans MS", cursive',
                }}
              >
                {quote}
              </p>
            </div>

            <Button
              onClick={() => onOpenChange(false)}
              className={`px-6 py-2 ${dialogStyles.buttons.primary}`}
              style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", cursive' }}
            >
              Thanks! 😊
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
