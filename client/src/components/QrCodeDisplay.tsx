import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";

interface QrCodeDisplayProps {
  accessUrl: string;
  qrCode: string;
  onDownload?: () => void;
}

export default function QrCodeDisplay({ accessUrl, qrCode, onDownload }: QrCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && accessUrl) {
      QRCode.toCanvas(canvasRef.current, accessUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#1c1917",
          light: "#fafaf8",
        },
      }).catch((err: Error) => {
        console.error("Failed to generate QR code:", err);
        toast.error("QRコード生成に失敗しました");
      });
    }
  }, [accessUrl]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.href = canvasRef.current.toDataURL("image/png");
      link.download = `qr-code-${qrCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QRコードをダウンロードしました");
      onDownload?.();
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(accessUrl);
    toast.success("アクセスURLをコピーしました");
  };

  return (
    <div className="flex flex-col items-center gap-6 rounded-[24px] border border-stone-200/80 bg-white/80 p-8">
      <div className="rounded-[16px] border-2 border-stone-200/50 bg-white p-4">
        <canvas ref={canvasRef} />
      </div>

      <div className="w-full space-y-3">
        <div className="rounded-[16px] border border-stone-200/80 bg-stone-50/50 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">アクセスURL</p>
          <p className="mt-2 break-all text-sm font-mono text-stone-900">{accessUrl}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-full border-stone-300 bg-white/70"
            onClick={handleCopyUrl}
          >
            <Copy className="mr-2 h-4 w-4" />
            URLをコピー
          </Button>
          <Button
            className="flex-1 rounded-full bg-stone-900 hover:bg-stone-800"
            onClick={handleDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            ダウンロード
          </Button>
        </div>
      </div>
    </div>
  );
}
