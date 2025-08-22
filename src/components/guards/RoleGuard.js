// src/components/guards/RoleGuard.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RoleGuard({ allow, children }) {
  const { user, userRole, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/home" replace />;
  if (allow && userRole !== allow) return <Navigate to="/home" replace />;
  return children;
}
