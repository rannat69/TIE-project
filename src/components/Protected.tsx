import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Role } from "@/data/types";
import { useApp } from "@/data/store";
import {
  canAccessInstructorRoute,
  getPostLoginPath,
} from "@/lib/userCapabilities";

const Protected = ({ role, children }: { role: Role; children: ReactNode }) => {
  const authReady = useApp((s) => s.authReady);
  const usersReady = useApp((s) => s.usersReady);
  const user = useApp((s) => s.users.find((u) => u.id === s.currentUserId));
  const courses = useApp((s) => s.courses);
  const projects = useApp((s) => s.projects);

  while (!user) {
    console.log("waiting for user...");
    // wait 1 second
    const start = Date.now();
    while (Date.now() - start < 2000) {
      // do nothing
    }
  }

  if (!authReady) return null;
  if (!usersReady) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "instructor") {
    if (!canAccessInstructorRoute(user, courses))
      return (
        <Navigate to={getPostLoginPath(user, courses, projects)} replace />
      );
    return <>{children}</>;
  }
  if (user.role !== role)
    return <Navigate to={getPostLoginPath(user, courses, projects)} replace />;
  return <>{children}</>;
};

export default Protected;
