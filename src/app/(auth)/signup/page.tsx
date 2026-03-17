import { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Регистрация",
};

export default function Signup() {
  return <AuthCard mode="signup" />;
}
