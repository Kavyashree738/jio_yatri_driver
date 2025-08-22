// src/components/guards/OnlyIfNotRegistered.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function OnlyIfNotRegistered({ children }) {
  const { isRegistered, loading } = useAuth();
  if (loading) return null;
  return isRegistered ? <Navigate replace to="/" /> : children;
}
