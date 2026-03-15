import { AuthDialog } from "@/components/Auth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { HelpCircle, LogOut, Settings, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SettingsDialog } from "./SettingsDialog";

interface ProfilePanelProps {
  onOpenAuthDialog?: () => void;
}

export function ProfilePanel({ onOpenAuthDialog }: ProfilePanelProps) {
  const { user, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = user?.email?.split("@")[0] || "";
  const initial = displayName[0]?.toUpperCase() || "U";

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen]);

  const handleSettingsClick = () => {
    setIsMenuOpen(false);
    setIsSettingsOpen(true);
  };

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    await signOut();
  };

  const handleSignIn = () => {
    setIsMenuOpen(false);
    if (onOpenAuthDialog) {
      onOpenAuthDialog();
    } else {
      setIsAuthOpen(true);
    }
  };

  return (
    <div ref={menuRef} className="fixed bottom-4 left-4 z-40">
      {/* Profile Button */}
      <Button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="relative w-12 h-12 rounded-2xl bg-white/95 hover:bg-amber-50 border-2 border-amber-200 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center overflow-hidden"
        style={{
          boxShadow: "0 2px 0 0 rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)",
        }}
      >
        {/* Paper texture */}
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.02)_2px,rgba(0,0,0,0.02)_4px)]"></div>

        {user ? (
          <span className="relative z-10 text-lg font-bold text-amber-700">
            {initial}
          </span>
        ) : (
          <User className="relative z-10 w-5 h-5 text-amber-700" />
        )}
      </Button>

      {/* Profile Menu - Slides in from bottom */}
      <div
        className={`
          absolute bottom-16 left-0 w-72 
          bg-white/95 border-2 border-amber-200 rounded-2xl shadow-xl 
          overflow-hidden
          transition-all duration-300 ease-out origin-bottom-left
          ${
            isMenuOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-2 pointer-events-none"
          }
        `}
        style={{
          boxShadow:
            "0 4px 6px -1px rgba(0,0,0,0.1), 0 10px 15px -3px rgba(0,0,0,0.1)",
        }}
      >
        {/* Paper texture overlay */}
        <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)] pointer-events-none"></div>

        {/* User Info Header */}
        <div className="relative z-10 p-4 border-b border-amber-100">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm">
                <span className="text-lg font-bold text-amber-700">
                  {initial}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-stone-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-stone-600 font-medium">Not signed in</p>
            </div>
          )}
        </div>

        {/* Menu Options */}
        <div className="relative z-10 py-2">
          {/* Settings */}
          <button
            onClick={handleSettingsClick}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/60 transition-colors text-left text-stone-700"
          >
            <Settings className="w-5 h-5 text-stone-600" />
            <span className="text-sm font-medium">Settings</span>
          </button>

          {/* Get Help */}
          <button
            onClick={() => {
              setIsMenuOpen(false);
              window.open(
                "https://github.com/yourusername/budgetability/issues",
                "_blank"
              );
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/60 transition-colors text-left text-stone-700"
          >
            <HelpCircle className="w-5 h-5 text-stone-600" />
            <span className="text-sm font-medium">Get help</span>
          </button>

          {/* Sign In / Sign Out */}
          {user ? (
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50/60 transition-colors text-left border-t border-amber-100 mt-2"
            >
              <LogOut className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-600">Log out</span>
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/60 transition-colors text-left border-t border-amber-100 mt-2"
            >
              <User className="w-5 h-5 text-amber-700" />
              <span className="text-sm font-medium text-amber-700">
                Sign in
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* Auth Dialog (self-contained fallback) */}
      <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />
    </div>
  );
}
