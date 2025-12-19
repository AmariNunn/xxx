import { ReactNode } from "react";

interface ServicePlanOptionProps {
  id: string;
  value: string;
  icon: ReactNode;
  label: string;
  name: string;
}

export default function ServicePlanOption({ id, value, icon, label, name }: ServicePlanOptionProps) {
  return (
    <div>
      <input
        type="radio"
        id={id}
        name={name}
        className="hidden peer"
        required
        value={value}
      />
      <label
        htmlFor={id}
        className="flex flex-col items-center justify-center p-4 text-textColor bg-white border border-gray-300 rounded-lg cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 hover:bg-gray-50 transition"
      >
        <div className="mb-2 text-lg">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </label>
    </div>
  );
}
