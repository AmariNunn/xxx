import { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { FormControl } from "@/components/ui/form";

interface PasswordInputProps {
  id: string;
  placeholder: string;
  className?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps & React.InputHTMLAttributes<HTMLInputElement>>(
  ({ id, placeholder, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    return (
      <div className="relative">
        <FormControl>
          <Input
            ref={ref}
            type={showPassword ? "text" : "password"}
            id={id}
            placeholder={placeholder}
            className={className}
            {...props}
          />
        </FormControl>
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          onClick={togglePasswordVisibility}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
