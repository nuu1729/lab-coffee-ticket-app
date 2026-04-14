import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PAYMENT_OPTIONS = [
  { code: "paypay", label: "PayPay" },
  { code: "cash", label: "現金" },
] as const;

export default function InstantPurchaseCard() {
  const [paymentMethod, setPaymentMethod] = useState<"paypay" | "cash">("paypay");
  const utils = trpc.useUtils();

  const instantPurchaseMutation = trpc.ticket.instantPurchase.useMutation({
    onSuccess: async (result) => {
      toast.success(`✨ チケット1枚を${result.priceYen}円で購入しました！`);
      setPaymentMethod("paypay");
      await Promise.all([
        utils.ticket.dashboard.invalidate(),
        utils.ticket.purchaseHistory.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "購入に失敗しました");
    },
  });

  return (
    <Card className="rounded-[28px] border-white/60 bg-gradient-to-br from-amber-50/80 to-orange-50/60 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-700">Quick Purchase</p>
            <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
              即時購入
            </CardTitle>
          </div>
          <div className="rounded-full bg-amber-500 p-3 text-white">
            <Zap className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-white/50 p-4">
          <p className="text-sm text-stone-600">1枚 <span className="text-xl font-bold text-amber-600">70円</span></p>
          <p className="mt-1 text-xs text-stone-500">申請不要で即座に購入できます</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">支払方法</p>
          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "paypay" | "cash")}>
            <SelectTrigger className="h-12 rounded-2xl border-stone-200 bg-white/70">
              <SelectValue placeholder="支払方法を選択" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-stone-200 bg-white/95 backdrop-blur">
              {PAYMENT_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => instantPurchaseMutation.mutate({ paymentMethod })}
          disabled={instantPurchaseMutation.isPending}
          className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold"
        >
          {instantPurchaseMutation.isPending ? "購入中..." : "今すぐ購入"}
        </Button>

        <p className="text-xs text-stone-500 text-center">
          購入申請として記録され、自動承認されます
        </p>
      </CardContent>
    </Card>
  );
}
