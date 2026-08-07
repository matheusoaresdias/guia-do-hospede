interface HostCardProps {
  name: string;
  phone: string;
}

export function HostCard({ name, phone }: HostCardProps) {
  const cleanPhone = phone.replace(/[^\d+]/g, "");
  const whatsappNumber = cleanPhone.replace(/^\+/, "");
  const displayPhone = formatDisplayPhone(phone);

  return (
    <div className="space-y-2">
      <p className="text-lg font-medium text-warm-900">
        {name}
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={`tel:${cleanPhone}`}
          className="inline-flex items-center justify-center h-[44px] min-w-[44px] rounded-lg bg-brand-600 text-white text-sm font-medium px-4 hover:bg-brand-700 transition-colors"
        >
          {displayPhone}
        </a>
        {/* Verde do WhatsApp, não da paleta Seazone — é reconhecimento de marca do botão */}
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-[44px] min-w-[44px] rounded-lg bg-green-600 text-white text-sm font-medium px-4 hover:bg-green-700 transition-colors"
          aria-label="Conversar pelo WhatsApp"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

function formatDisplayPhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  // Tenta formato brasileiro: +55 DDD NNNN-NNNN ou +55 DDD NNNNN-NNNN
  const brMatch = cleaned.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  if (brMatch) {
    return `(${brMatch[1]}) ${brMatch[2]}-${brMatch[3]}`;
  }
  return phone;
}
