
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginLogo } from "@/components/login-logo";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: response.status === 429 ? "Too many attempts" : "Login Failed",
          description: data.error || "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }

      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      toast({
        title: "Login Failed",
        description: "Could not reach the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-200 bg-card p-8 shadow-lg">
        <div className="mb-10 flex justify-center">
          <LoginLogo className="h-16 w-auto" />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Login
        </h1>

        <form className="space-y-8" onSubmit={handleLogin}>
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="flex items-center gap-2 text-gray-600"
            >
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@corp-plan.com"
              className="border-0 border-b border-gray-300 bg-transparent px-1 pb-2 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="flex items-center gap-2 text-gray-600"
              >
                <Lock className="h-4 w-4" />
                <span>Password</span>
              </Label>
              <Link
                href="#"
                className="text-sm text-primary/80 hover:text-primary"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className="border-0 border-b border-gray-300 bg-transparent px-1 pb-2 pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-primary py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
