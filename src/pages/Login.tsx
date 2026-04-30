import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { toast } from "sonner";

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

  const backendUrlRaw = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() || "";
  const backendUrl = backendUrlRaw === "." || backendUrlRaw === "/" ? window.location.origin : backendUrlRaw;

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
    // keep hook for future auth-related effects
  }, []);

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
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }

    try {
      setBusy(true);
      await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await ensureUserRow();
      toast.success("Account created.");
      navigate("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-up failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-6 py-12 lg:py-20">
        <div className="mx-auto max-w-xl">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg shadow-elegant">
              <img src="/favicon.svg" alt="Project Tracking" className="h-11 w-11" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Project Tracking</h1>
              <p className="text-sm text-muted-foreground">Student project tracking</p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="mb-2 text-4xl font-semibold leading-tight text-foreground lg:text-5xl">
              Sign in to continue
            </h2>
          </div>

          <Card className="academic-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSignIn();
                  }}
                />
              </div>

              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

              <Button
                className="w-full"
                onClick={() => void handleSignIn()}
                disabled={busy || !email.trim() || !password}
              >
                {busy ? "Signing in..." : "Sign in"}
              </Button>

              <div className="rounded-md border border-border bg-gradient-subtle p-4">
                <div className="mb-2 text-sm font-semibold text-foreground">First time here?</div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Create an account with email and password, then fill in your profile details.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                      Full name (Surname, First name)
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="CHAN, Tai Man"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hkustEmail" className="text-sm font-medium text-foreground">
                      HKUST email (optional)
                    </Label>
                    <Input
                      id="hkustEmail"
                      type="email"
                      placeholder="name@connect.ust.hk"
                      value={hkustEmail}
                      onChange={(e) => setHkustEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="programme" className="text-sm font-medium text-foreground">
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

                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  onClick={() => void handleSignUp()}
                  disabled={busy || !email.trim() || !password}
                >
                  {busy ? "Signing up..." : "Sign up"}
                </Button>
              </div>

            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;