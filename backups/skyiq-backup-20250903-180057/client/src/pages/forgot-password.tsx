import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/validators";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
import AuthLayout from "@/components/auth-layout";
import AuthLogo from "@/components/auth-logo";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reset link sent",
        description: "Please check your email for instructions to reset your password.",
      });
      // Redirect back to login page
      setLocation("/login");
    },
    onError: (error) => {
      toast({
        title: "Request failed",
        description: error.message || "There was an error sending the reset link. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    forgotPasswordMutation.mutate(data);
  };

  return (
    <AuthLayout>
      <AuthLogo />

      <Card className="bg-white rounded-xl shadow-md">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-textColor">Reset Password</h2>
            <p className="text-textColor/70 mt-2">
              We'll send you instructions to reset your password
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="reset-email" className="text-textColor">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="reset-email"
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

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-secondary text-white font-medium py-2.5 px-4 rounded-lg transition duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-primary hover:text-secondary text-sm">
                  Back to login
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
