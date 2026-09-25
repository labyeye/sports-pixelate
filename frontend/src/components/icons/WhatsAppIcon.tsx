import whatsappLogo from "../../../assets/whatsapp.png";

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <img
      src={whatsappLogo}
      alt="WhatsApp"
      className={`object-contain ${className ?? ""}`}
    />
  );
}
