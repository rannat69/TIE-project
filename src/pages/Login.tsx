import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { toast } from "sonner";

/** localStorage key for Firebase email-link (magic link) sign-in */
const EMAIL_LINK_STORAGE_KEY = "tie_emailForSignIn";

/** Avoid duplicate automatic completion of the same email link (StrictMode / re-renders) */
let emailLinkAutoSignInStarted = false;
/** Open the cross-device email confirmation dialog only once per load */
let emailLinkConfirmDialogShown = false;

const Login = () => {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [hkustEmail, setHkustEmail] = useState("");
  const [programme, setProgramme] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const pendingEmailLinkHrefRef = useRef<string | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const backendUrlRaw =
    (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() || "";
  const backendUrl =
    backendUrlRaw === "." || backendUrlRaw === "/"
      ? window.location.origin
      : backendUrlRaw;

  const ensureUserRow = async () => {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser || !backendUrl) return;
    const token = await fbUser.getIdToken();
    await fetch(`${backendUrl.replace(/\/$/, "")}/users/ensure`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: fullName.trim(),
        hkustEmail: hkustEmail.trim(),
        programme: programme.trim(),
      }),
    });
  };

  useEffect(() => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(firebaseAuth, href)) return;

    const stored = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);

    const finishFromLink = async (addr: string) => {
      setBusy(true);
      try {
        await signInWithEmailLink(firebaseAuth, href, addr);
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        window.history.replaceState(
          {},
          document.title,
          `${window.location.origin}/login`,
        );
        await ensureUserRow();
        toast.success("Signed in with email link.");
        navigate("/");
      } catch {
        toast.error(
          "This sign-in link is invalid or has expired. Request a new one.",
        );
        window.history.replaceState(
          {},
          document.title,
          `${window.location.origin}/login`,
        );
      } finally {
        setBusy(false);
        emailLinkAutoSignInStarted = false;
      }
    };

    if (stored?.trim()) {
      if (emailLinkAutoSignInStarted) return;
      emailLinkAutoSignInStarted = true;
      void finishFromLink(stored.trim());
      return;
    }

    if (emailLinkConfirmDialogShown) return;
    emailLinkConfirmDialogShown = true;
    pendingEmailLinkHrefRef.current = href;
    setConfirmEmailOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on load for email-link URL; ensureUserRow uses latest state when completing
  }, [navigate]);

  const handleSignIn = async () => {
    setError(null);
    try {
      setBusy(true);
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      await ensureUserRow();
      // Role-based redirect happens via <Protected /> once Firestore user loads.
      navigate("/");
    } catch {
      setError("Sign-in failed. Check your email/password in Firebase Auth.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    const schoolLogin = hkustEmail.trim();
    if (!schoolLogin || !schoolLogin.includes("@")) {
      setError(
        "Please enter a valid school email — we use it as your account login.",
      );
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }

    try {
      setBusy(true);
      await createUserWithEmailAndPassword(firebaseAuth, schoolLogin, password);
      await ensureUserRow();
      toast.success("Account created.");
      navigate("/");
    } catch (e) {
      const code =
        typeof e === "object" && e && "code" in e
          ? String((e as { code: string }).code)
          : "";
      if (code === "auth/email-already-in-use") {
        setError(
          "An account already exists for this school email. Switch to Sign in or use Forgot password.",
        );
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (code === "auth/invalid-email") {
        setError("That email address does not look valid.");
      } else {
        setError(e instanceof Error ? e.message : "Sign-up failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendMagicLink = async () => {
    setForgotError(null);
    const addr = forgotEmail.trim();
    if (!addr || !addr.includes("@")) {
      setForgotError("Please enter a valid email address.");
      return;
    }
    try {
      setForgotBusy(true);
      await sendSignInLinkToEmail(firebaseAuth, addr, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, addr);
      toast.success("Check your inbox for the sign-in link.");
      setForgotOpen(false);
    } catch (e) {
      const code =
        typeof e === "object" && e && "code" in e
          ? String((e as { code: string }).code)
          : "";
      if (code === "auth/operation-not-allowed") {
        setForgotError(
          "Email link sign-in is turned off in Firebase. Enable “Email link (passwordless sign-in)” under Authentication → Sign-in method → Email/Password.",
        );
      } else {
        setForgotError("Could not send the email. Try again in a moment.");
      }
    } finally {
      setForgotBusy(false);
    }
  };

  const handleConfirmEmailLink = async () => {
    const href = pendingEmailLinkHrefRef.current;
    const addr = confirmEmail.trim();
    if (!href || !addr.includes("@")) {
      toast.error("Enter the same email address you used to request the link.");
      return;
    }
    try {
      setConfirmBusy(true);
      await signInWithEmailLink(firebaseAuth, addr, href);
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      window.history.replaceState(
        {},
        document.title,
        `${window.location.origin}/login`,
      );
      await ensureUserRow();
      toast.success("Signed in with email link.");
      setConfirmEmailOpen(false);
      pendingEmailLinkHrefRef.current = null;
      emailLinkConfirmDialogShown = false;
      navigate("/");
    } catch {
      toast.error(
        "That email does not match this link, or the link has expired.",
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-6 py-12 lg:py-20">
        <div className="mx-auto max-w-xl">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg shadow-elegant">
              <img
                src="/favicon.svg"
                alt="Project Tracking"
                className="h-11 w-11"
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Project Tracking
              </h1>
              <p className="text-sm text-muted-foreground">
                Student project tracking
              </p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="mb-2 text-4xl font-semibold leading-tight text-foreground lg:text-5xl">
              {authMode === "signin"
                ? "Sign in to continue"
                : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {authMode === "signin"
                ? "Use your course credentials, or switch to Create account if you are new."
                : "Add your name and school email, then a password. You will sign in with the same school email and password."}
            </p>
          </div>

          <Card className="academic-card p-6">
            <div className="space-y-4">
              <div className="flex rounded-lg border border-border bg-muted/40 p-1">
                <Button
                  type="button"
                  variant={authMode === "signin" ? "secondary" : "ghost"}
                  className="flex-1"
                  onClick={() => {
                    setAuthMode("signin");
                    setError(null);
                  }}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={authMode === "signup" ? "secondary" : "ghost"}
                  className="flex-1"
                  onClick={() => {
                    setAuthMode("signup");
                    setError(null);
                  }}
                >
                  Create account
                </Button>
              </div>

              {authMode === "signin" ? (
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    placeholder="you@uni.edu"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </div>
              ) : null}

              {authMode === "signup" ? (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="fullName"
                      className="text-sm font-medium text-foreground"
                    >
                      Full name (Surname, First name)
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="CHAN, Tai Man"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="hkustEmail"
                        className="text-sm font-medium text-foreground"
                      >
                        School email (optional)
                      </Label>
                      <Input
                        id="hkustEmail"
                        type="email"
                        autoComplete="email"
                        placeholder="name@connect.ust.hk"
                        value={hkustEmail}
                        onChange={(e) => {
                          setHkustEmail(e.target.value);
                          if (error) setError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="programme"
                        className="text-sm font-medium text-foreground"
                      >
                        Programme
                      </Label>
                      <Input
                        id="programme"
                        placeholder="e.g. BEng, BBA, MSc FinTech, etc."
                        value={programme}
                        onChange={(e) => setProgramme(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    authMode === "signup" ? "new-password" : "current-password"
                  }
                  placeholder={
                    authMode === "signup"
                      ? "Choose a password (min. 6 characters)"
                      : "Enter your password"
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (authMode === "signin") void handleSignIn();
                      else void handleSignUp();
                    }
                  }}
                />
                {authMode === "signin" ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => {
                        setForgotEmail(email.trim());
                        setForgotError(null);
                        setForgotOpen(true);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="text-sm font-medium text-destructive">{error}</p>
              ) : null}

              {authMode === "signin" ? (
                <Button
                  className="w-full"
                  onClick={() => void handleSignIn()}
                  disabled={busy || !email.trim() || !password}
                >
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => void handleSignUp()}
                  disabled={
                    busy ||
                    !hkustEmail.trim() ||
                    !hkustEmail.includes("@") ||
                    !password
                  }
                >
                  {busy ? "Signing up..." : "Sign up"}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in with email link</DialogTitle>
            <DialogDescription>
              Enter your account email and we will send you a magic link. After
              you open it, you will be signed in without your password (you can
              keep using your password later if you like).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@uni.edu"
              value={forgotEmail}
              onChange={(e) => {
                setForgotEmail(e.target.value);
                if (forgotError) setForgotError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSendMagicLink();
              }}
            />
            {forgotError ? (
              <p className="text-sm font-medium text-destructive">
                {forgotError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setForgotOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSendMagicLink()}
              disabled={forgotBusy || !forgotEmail.trim()}
            >
              {forgotBusy ? "Sending…" : "Send magic link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmEmailOpen}
        onOpenChange={(open) => {
          setConfirmEmailOpen(open);
          if (!open) {
            emailLinkConfirmDialogShown = false;
            pendingEmailLinkHrefRef.current = null;
            if (isSignInWithEmailLink(firebaseAuth, window.location.href)) {
              window.history.replaceState(
                {},
                document.title,
                `${window.location.origin}/login`,
              );
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm your email</DialogTitle>
            <DialogDescription>
              Open the link on the same device and browser where you requested
              it for the fastest sign-in. If you opened it elsewhere, enter the
              email address you used below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-email-link">Email</Label>
            <Input
              id="confirm-email-link"
              type="email"
              autoComplete="email"
              placeholder="you@uni.edu"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleConfirmEmailLink();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEmailOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmEmailLink()}
              disabled={confirmBusy || !confirmEmail.trim()}
            >
              {confirmBusy ? "Signing in…" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
