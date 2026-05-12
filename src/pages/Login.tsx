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
import { useLayoutEffect, useRef, useState } from "react";
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

function authErrorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e && "code" in e)
    return String((e as { code: string }).code);
  return undefined;
}

function emailFromSignInLinkUrl(href: string): string {
  try {
    const raw = new URL(href).searchParams.get("email");
    if (!raw) return "";
    return decodeURIComponent(raw).trim();
  } catch {
    return "";
  }
}

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
  /** Present when the URL is a Firebase email sign-in link (user must tap Complete — auto sign-in breaks with scanners). */
  const [magicLink, setMagicLink] = useState<{ href: string } | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
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

  useLayoutEffect(() => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(firebaseAuth, href)) {
      setMagicLink(null);
      return;
    }
    const stored = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY) || "";
    const fromUrl = emailFromSignInLinkUrl(href);
    const def = (stored || fromUrl).trim().toLowerCase();
    setMagicLink({ href });
    setMagicLinkEmail(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- detect email-link URL once when Login mounts
  }, []);

  const handleCompleteMagicLink = async () => {
    const href = magicLink?.href;
    if (!href) return;
    const addr = magicLinkEmail.trim().toLowerCase();
    if (!addr.includes("@")) {
      toast.error(
        "Enter the email address you used when you requested the link.",
      );
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailLink(firebaseAuth, addr, href);
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      window.history.replaceState(
        {},
        document.title,
        `${window.location.origin}/login`,
      );
      setMagicLink(null);
      try {
        await ensureUserRow();
      } catch {
        toast.error(
          "Signed in, but profile sync failed. Refresh the page or try again.",
        );
        navigate("/");
        return;
      }
      toast.success("Signed in with email link.");
      navigate("/");
    } catch (e) {
      const code = authErrorCode(e);
      const hint = code ? ` (${code})` : "";
      console.warn("signInWithEmailLink failed", code, e);
      if (
        code === "auth/invalid-action-code" ||
        code === "auth/expired-action-code"
      ) {
        toast.error(
          "This link was already used or has expired (email scanners sometimes use it first). Send a new magic link, then use “Complete sign-in” here.",
        );
        setMagicLink(null);
        window.history.replaceState(
          {},
          document.title,
          `${window.location.origin}/login`,
        );
      } else if (code === "auth/invalid-email") {
        toast.error("That email address is not valid. Check for typos.");
      } else if (code === "auth/invalid-credential") {
        toast.error(
          "The email must exactly match the address you requested the link for (same spelling, no extra spaces). If it still fails, send a new magic link.",
        );
      } else if (
        code === "auth/unauthorized-continue-uri" ||
        code === "auth/invalid-continue-uri"
      ) {
        toast.error(
          "This site’s URL is not allowed for email links. Add this domain under Firebase Authentication → Settings → Authorized domains.",
        );
      } else if (code === "auth/network-request-failed") {
        toast.error(
          "Network error while contacting Firebase. Check your connection and try again.",
        );
      } else if (code === "auth/too-many-requests") {
        toast.error(
          "Too many attempts. Wait a few minutes, then request a new link.",
        );
      } else if (code === "auth/operation-not-allowed") {
        toast.error(
          "Email link sign-in is not allowed for this project. In Firebase Console: Authentication → Sign-in method → Email/Password → enable “Email link (passwordless sign-in)”.",
        );
      } else {
        toast.error(
          `Could not complete sign-in${hint}. Use the exact email the link was sent to, or request a new magic link. If this keeps happening, check the browser console for details.`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

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
      window.localStorage.setItem(
        EMAIL_LINK_STORAGE_KEY,
        addr.trim().toLowerCase(),
      );
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
              {magicLink ? (
                <div className="space-y-3 rounded-md border border-primary/25 bg-primary/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Finish signing in from your email
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Email security tools sometimes open links before you do,
                      which uses up a one-time sign-in link. Confirm the email
                      you requested the link for, then tap Complete sign-in.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="magic-link-email"
                      className="text-sm font-medium text-foreground"
                    >
                      Email
                    </Label>
                    <Input
                      id="magic-link-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@uni.edu"
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCompleteMagicLink();
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      busy ||
                      !magicLinkEmail.trim() ||
                      !magicLinkEmail.includes("@")
                    }
                    onClick={() => void handleCompleteMagicLink()}
                  >
                    {busy ? "Signing in…" : "Complete sign-in"}
                  </Button>
                </div>
              ) : null}

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
              you open the link in your browser, use the “Complete sign-in”
              button on this page (do not rely on the page loading alone).
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
    </div>
  );
};

export default Login;
