import { useNavigate } from "react-router-dom";
import abeilleImg from "@/assets/abeille.png";

interface BulbizLogoProps {
  size?: number;
  showText?: boolean;
}

export function BulbizLogo({ size = 24, showText = true }: BulbizLogoProps) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
      <img src={abeilleImg} alt="Bulbiz" className="rounded-full object-cover" style={{ width: size, height: size }} />
      {showText && <span className="text-lg font-bold text-foreground">Bulbiz</span>}
    </button>
  );
}
