import { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Вход",
};

export default function Signin() {
  return <AuthCard mode="signin" />;
}
