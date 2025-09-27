import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="bg-background font-inter min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full mx-auto">
        {children}
      </div>
      <footer className="mt-8 text-center text-sm text-textColor/50">
        <p>© {new Date().getFullYear()} VoxIntel. All rights reserved.</p>
      </footer>
    </div>
  );
}
