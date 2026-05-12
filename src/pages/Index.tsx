import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/data/store";

const Index = () => {
  const authReady = useApp((s) => s.authReady);
  const usersReady = useApp((s) => s.usersReady);

  const user = useApp((s) => s.users.find((u) => u.id === s.currentUserId));
  const location = useLocation();

  if (!authReady) return null;
  // Session exists but Firestore users snapshot hasn't arrived yet
  if (!usersReady) return null;
  if (user) return <Navigate to={`/${user.role}`} replace />;
  // Preserve query/hash so email-link (magic link) params survive / → /login redirect
  return (
    <Navigate
      to={{ pathname: "/login", search: location.search, hash: location.hash }}
      replace
    />
  );
};

export default Index;
