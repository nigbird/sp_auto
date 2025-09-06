"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginLogo } from "@/components/login-logo";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-200 bg-card p-8 shadow-lg">
        <div className="mb-10 flex justify-center">
          <LoginLogo className="h-16 w-auto" />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Login
        </h1>

        <form className="space-y-8">
          <div className="space-y-2">
            <Label
              htmlFor="phone"
              className="flex items-center gap-2 text-gray-600"
            >
              <Phone className="h-4 w-4" />
              <span>Phone Number</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0912345678"
              className="border-0 border-b border-gray-300 bg-transparent px-1 pb-2 focus-visible:ring-0 focus-visible:ring-offset-0"
              defaultValue="0912345678"
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
                defaultValue="••••••••"
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
            className="w-full rounded-full bg-primary py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
