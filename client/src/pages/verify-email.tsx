import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AuthLayout from "@/components/auth-layout";
import AuthLogo from "@/components/auth-logo";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      verifyEmailMutation.mutate(tokenParam);
    } else {
      setVerificationStatus('error');
      setMessage('No verification token provided');
    }
  }, []);

  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("GET", `/api/auth/verify-email/${token}`);
      return response.json();
    },
    onSuccess: (data) => {
      setVerificationStatus('success');
      setMessage(data.message || 'Email verified successfully!');
    },
    onError: (error: any) => {
      setVerificationStatus('error');
      setMessage(error.message || 'Verification failed. The token may be invalid or expired.');
    },
  });

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'loading':
        return <Loader2 className="w-16 h-16 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-600" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-600" />;
    }
  };

  const getStatusTitle = () => {
    switch (verificationStatus) {
      case 'loading':
        return 'Verifying Your Email...';
      case 'success':
        return 'Email Verified!';
      case 'error':
        return 'Verification Failed';
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AuthLogo />
        
        <Card className="w-full max-w-md bg-white rounded-xl shadow-md mt-8">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            
            <h1 className="text-2xl font-bold text-textColor mb-4">
              {getStatusTitle()}
            </h1>
            
            <p className="text-textColor/70 mb-6">
              {message}
            </p>

            {verificationStatus === 'success' && (
              <Link href="/login">
                <Button className="w-full bg-primary hover:bg-secondary text-white py-3">
                  Continue to Login
                </Button>
              </Link>
            )}

            {verificationStatus === 'error' && (
              <div className="space-y-3">
                <Link href="/signup">
                  <Button variant="outline" className="w-full">
                    Try Signing Up Again
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="w-full bg-primary hover:bg-secondary text-white py-3">
                    Go to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}