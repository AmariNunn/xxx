import { Check, X } from "lucide-react";

interface PasswordRequirement {
  text: string;
  met: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export default function PasswordStrengthIndicator({ password, className = "" }: PasswordStrengthIndicatorProps) {
  const requirements: PasswordRequirement[] = [
    {
      text: "At least 8 characters",
      met: password.length >= 8
    },
    {
      text: "Contains uppercase letter",
      met: /[A-Z]/.test(password)
    },
    {
      text: "Contains lowercase letter", 
      met: /[a-z]/.test(password)
    },
    {
      text: "Contains number",
      met: /\d/.test(password)
    },
    {
      text: "Contains special character",
      met: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  ];

  const strengthScore = requirements.filter(req => req.met).length;
  const strengthPercentage = (strengthScore / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strengthScore < 2) return "bg-red-500";
    if (strengthScore < 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (strengthScore < 2) return "Weak";
    if (strengthScore < 4) return "Medium";
    return "Strong";
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Password strength</span>
          <span className={`font-medium ${
            strengthScore < 2 ? "text-red-600" : 
            strengthScore < 4 ? "text-yellow-600" : 
            "text-green-600"
          }`}>
            {getStrengthText()}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password must contain:</p>
        {requirements.map((requirement, index) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            {requirement.met ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-gray-400" />
            )}
            <span className={requirement.met ? "text-green-600" : "text-gray-500 dark:text-gray-400"}>
              {requirement.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}