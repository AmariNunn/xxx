import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/auth-layout";
import AuthLogo from "@/components/auth-logo";
import { Check } from "lucide-react";

export default function RegistrationSuccess() {
  return (
    <AuthLayout>
      <AuthLogo />

      <Card className="bg-white rounded-xl shadow-md">
        <CardContent className="p-6 md:p-8 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-success/10 flex items-center justify-center rounded-full mb-4">
              <Check className="text-2xl text-success" />
            </div>
            <h2 className="text-2xl font-semibold text-textColor mb-2">
              Registration Successful!
            </h2>
            <p className="text-textColor/70 mb-6">
              Your account has been created successfully. Please check your email to verify your account.
            </p>
            <Link href="/login">
              <Button className="bg-primary hover:bg-secondary text-white font-medium py-2.5 px-6 rounded-lg transition duration-200">
                Go to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
