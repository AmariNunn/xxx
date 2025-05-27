import { Phone } from "lucide-react";
import AudioWave from "./audio-wave";

export default function AuthLogo() {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
        <Phone className="h-6 w-6" />
        VoxIntel
        <AudioWave size="md" className="text-blue-600" />
      </h1>
      <p className="text-textColor/70 mt-2">Smart Call Intelligence Platform</p>
    </div>
  );
}
