import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validators";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import AuthLayout from "@/components/auth-layout";
import AuthLogo from "@/components/auth-logo";
import PasswordInput from "@/components/password-input";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isAuthenticated, isLoading, login } = useAuth();
  
  // Force clear any existing authentication data on login page
  useEffect(() => {
    // Clear any existing authentication data when on login page
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Use auth hook to handle the login process
      login(data.user);
      
      toast({
        title: "Login successful", 
        description: "Redirecting to dashboard..."
      });
      // Redirect to dashboard  
      setLocation("/dashboard");
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setIsSubmitting(true);
    loginMutation.mutate(data);
  };

  return (
    <AuthLayout>
      <AuthLogo />

      <Card className="bg-white rounded-xl shadow-md">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-textColor">Sign In</h2>
            <p className="text-textColor/70 mt-2">Welcome back! Please enter your details</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="login-email" className="text-textColor">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        className="w-full"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel htmlFor="login-password" className="text-textColor">Password</FormLabel>
                      <Link href="/forgot-password" className="text-sm text-primary hover:text-secondary">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput
                        id="login-password"
                        placeholder="Enter your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        id="remember-me"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="remember-me" className="text-sm text-textColor/80">
                        Remember me
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-secondary text-white font-medium py-2.5 px-4 rounded-lg transition duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-textColor/70">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:text-secondary font-medium">
                Create account
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
