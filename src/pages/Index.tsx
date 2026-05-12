import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/data/store";
import { firebaseAuth } from "@/lib/firebase";

const Index = () => {
  const authReady = useApp((s) => s.authReady);
  const usersReady = useApp((s) => s.usersReady);

  const user = useApp((s) => s.users.find((u) => u.id === s.currentUserId));
  const location = useLocation();
  // Still waiting for Firebase Auth to initialise
  if (!authReady) return null;

  // Firebase says no session → go to login immediately (covers sign-out)
  if (!firebaseAuth.currentUser) return <Navigate to="/login" replace />;

  // Session exists but Firestore users snapshot hasn't arrived yet
  if (!usersReady) return null;
  // Preserve query/hash so email-link (magic link) params survive / → /login redirect

  if (user) return <Navigate to={`/${user.role}`} replace />;

  return (
    <Navigate
      to={{ pathname: "/login", search: location.search, hash: location.hash }}
      replace
    />
  );
};

export default Index;
