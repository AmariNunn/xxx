import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { z } from "zod";

// Extended schema with confirmation and terms acceptance
const signupSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
  terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms and conditions" }) })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Phone, PhoneOutgoing, RefreshCw } from "lucide-react";
import PasswordStrengthIndicator from "@/components/password-strength-indicator";

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
import ServicePlanOption from "@/components/service-plan-option";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      businessName: "",
      phoneNumber: "",
      website: "",
      servicePlan: "inbound",
      terms: false,
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Registration successful",
        description: "Your account has been created. Please check your email.",
      });
      // Redirect to success page
      setLocation("/registration-success");
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: error.message || "There was an error creating your account. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: any) => {
    setIsSubmitting(true);
    signupMutation.mutate(data);
  };

  return (
    <AuthLayout>
      <AuthLogo />

      <Card className="bg-white rounded-xl shadow-md">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-textColor">Create Account</h2>
            <p className="text-textColor/70 mt-2">Join our Sky IQ platform</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="signup-email" className="text-textColor">
                      Email <span className="text-error">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="signup-email"
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
                    <FormLabel htmlFor="signup-password" className="text-textColor">
                      Password <span className="text-error">*</span>
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        id="signup-password"
                        placeholder="Create a password"
                        {...field}
                      />
                    </FormControl>
                    <PasswordStrengthIndicator password={field.value || ""} className="mt-3" />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="confirm-password" className="text-textColor">
                      Confirm Password <span className="text-error">*</span>
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        id="confirm-password"
                        placeholder="Confirm your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="business-name" className="text-textColor">
                      Business Name <span className="text-error">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="business-name"
                        type="text"
                        placeholder="Enter your business name"
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
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="phone-number" className="text-textColor">
                      Phone Number <span className="text-error">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="phone-number"
                        type="tel"
                        placeholder="Enter your phone number"
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
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="website" className="text-textColor">
                      Website (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="website"
                        type="url"
                        placeholder="Enter your website URL"
                        className="w-full"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="servicePlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-textColor block mb-3">
                      Service Plan <span className="text-error">*</span>
                    </FormLabel>
                    <div className="grid grid-cols-1 gap-3">
                      <FormControl>
                        <div className="flex flex-row space-x-3">
                          <div className="flex flex-row items-center space-x-3">
                            <div className="hidden">
                              <input
                                type="radio"
                                id="plan-inbound"
                                value="inbound"
                                checked={field.value === "inbound"}
                                onChange={() => field.onChange("inbound")}
                              />
                              <input
                                type="radio"
                                id="plan-outbound"
                                value="outbound"
                                checked={field.value === "outbound"}
                                onChange={() => field.onChange("outbound")}
                              />
                              <input
                                type="radio"
                                id="plan-both"
                                value="both"
                                checked={field.value === "both"}
                                onChange={() => field.onChange("both")}
                              />
                            </div>
                            
                            <div onClick={() => field.onChange("inbound")} className={`flex flex-col items-center justify-center p-4 text-textColor bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition w-full ${field.value === "inbound" ? "border-primary bg-primary/5" : ""}`}>
                              <Phone className="mb-2 text-lg" />
                              <span className="text-sm font-medium">Inbound</span>
                            </div>
                            
                            <div onClick={() => field.onChange("outbound")} className={`flex flex-col items-center justify-center p-4 text-textColor bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition w-full ${field.value === "outbound" ? "border-primary bg-primary/5" : ""}`}>
                              <PhoneOutgoing className="mb-2 text-lg" />
                              <span className="text-sm font-medium">Outbound</span>
                            </div>
                            
                            <div onClick={() => field.onChange("both")} className={`flex flex-col items-center justify-center p-4 text-textColor bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition w-full ${field.value === "both" ? "border-primary bg-primary/5" : ""}`}>
                              <RefreshCw className="mb-2 text-lg" />
                              <span className="text-sm font-medium">Both</span>
                            </div>
                          </div>
                        </div>
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        id="terms"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="terms" className="text-textColor/80 text-sm">
                        I agree to the{" "}
                        <a href="#" className="text-primary hover:underline">
                          Terms of Service
                        </a>{" "}
                        and{" "}
                        <a href="#" className="text-primary hover:underline">
                          Privacy Policy
                        </a>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-secondary text-white font-medium py-2.5 px-4 rounded-lg transition duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-textColor/70">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:text-secondary font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
