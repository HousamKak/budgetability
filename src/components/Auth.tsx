import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn, dialogStyles } from "@/styles";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const { signIn, signUp, resetPassword } = useAuth();

  // Elegant paper-themed icons
  const EmailIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );

  const LockIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );

  const UserCircleIcon = () => (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else {
          // Close dialog and redirect to verification waiting page
          onOpenChange(false);
          resetForm();
          navigate(`/auth/verify-email?email=${encodeURIComponent(email)}`);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else {
          onOpenChange(false);
          resetForm();
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email for a password reset link!");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
    setIsSignUp(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[425px] mx-2 sm:mx-auto"
        aria-describedby={undefined}
      >
        <div className={dialogStyles.paperDialog}>
          {/* Paper texture overlay */}
          <div className={dialogStyles.paperTexture}></div>

          {/* Yellow transparent tape */}
          <div className={dialogStyles.yellowTape}></div>

          {/* Torn edge effect */}
          <div className={dialogStyles.tornEdge}></div>

          <div className={dialogStyles.contentWrapper}>
            <DialogHeader className={dialogStyles.header.container}>
              <DialogTitle className={dialogStyles.header.title}>
                <UserCircleIcon />
                {isSignUp ? "Create Account" : "Welcome Back"}
              </DialogTitle>
              <p className={dialogStyles.header.subtitle}>
                {isSignUp
                  ? "Join to sync your budget across devices"
                  : "Sign in to access your budget"}
              </p>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className={dialogStyles.form.container}
            >
              <div className={dialogStyles.form.fieldContainer}>
                <Label htmlFor="email" className={dialogStyles.form.label}>
                  Email
                </Label>
                <div className={dialogStyles.form.inputWrapper}>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className={cn(
                      "pl-10 h-11 sm:h-10",
                      dialogStyles.form.input
                    )}
                    placeholder="your.email@example.com"
                  />
                  <div className={dialogStyles.form.iconContainer}>
                    <EmailIcon />
                  </div>
                </div>
              </div>

              <div className={dialogStyles.form.fieldContainer}>
                <Label htmlFor="password" className={dialogStyles.form.label}>
                  Password
                </Label>
                <div className={dialogStyles.form.inputWrapper}>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className={cn(
                      "pl-10 h-11 sm:h-10",
                      dialogStyles.form.input
                    )}
                    placeholder="Enter your password"
                  />
                  <div className={dialogStyles.form.iconContainer}>
                    <LockIcon />
                  </div>
                </div>
              </div>

              {isSignUp && (
                <div className={dialogStyles.form.fieldContainer}>
                  <Label
                    htmlFor="confirmPassword"
                    className={dialogStyles.form.label}
                  >
                    Confirm Password
                  </Label>
                  <div className={dialogStyles.form.inputWrapper}>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className={cn(
                        "pl-10 h-11 sm:h-10",
                        dialogStyles.form.input
                      )}
                      placeholder="Confirm your password"
                    />
                    <div className={dialogStyles.form.iconContainer}>
                      <LockIcon />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className={dialogStyles.messages.error}>{error}</div>
              )}

              {message && (
                <div className={dialogStyles.messages.success}>{message}</div>
              )}

              <Button
                type="submit"
                className={cn(
                  "w-full h-11 sm:h-10",
                  dialogStyles.buttons.primary
                )}
                disabled={isLoading}
              >
                {isLoading
                  ? "🔄 Loading..."
                  : isSignUp
                  ? "🚀 Create Account"
                  : "🔓 Sign In"}
              </Button>
            </form>

            <div className={dialogStyles.footer}>
              <Button
                type="button"
                variant="ghost"
                className={dialogStyles.buttons.ghost}
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                  setMessage("");
                }}
                disabled={isLoading}
              >
                {isSignUp
                  ? "← Already have an account? Sign In"
                  : "Don't have an account? Sign Up →"}
              </Button>

              {!isSignUp && (
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "text-stone-500 hover:text-stone-700 hover:bg-amber-50",
                    dialogStyles.buttons.ghost
                  )}
                  onClick={handleResetPassword}
                  disabled={isLoading || !email}
                >
                  🔑 Forgot Password?
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuthButton() {
  const { user, signOut, loading } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  if (loading) {
    return (
      <Button
        disabled
        className={cn(
          "rounded-2xl bg-amber-100 text-stone-600 border border-amber-200",
          dialogStyles.buttons.primary
        )}
      >
        🔄 Loading...
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2 bg-white/80 rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm border border-amber-200">
        <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-stone-700">
            {user.email?.[0]?.toUpperCase()}
          </span>
        </div>
        <span className="text-xs sm:text-sm text-stone-700 hidden sm:inline max-w-16 sm:max-w-24 truncate">
          {user.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="text-stone-600 hover:text-stone-800 hover:bg-amber-100 rounded-xl cursor-pointer h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
        >
          <span className="hidden sm:inline">Sign Out</span>
          <span className="sm:hidden">Out</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setShowAuthDialog(true)}
        className={cn(
          "rounded-xl sm:rounded-2xl h-8 sm:h-10 px-2 sm:px-4 text-sm",
          dialogStyles.buttons.primary
        )}
      >
        <span className="hidden sm:inline">🔐 Sign In</span>
        <span className="sm:hidden">🔐</span>
      </Button>
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
