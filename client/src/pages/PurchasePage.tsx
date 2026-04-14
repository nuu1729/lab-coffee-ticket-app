import DashboardLayout from "@/components/DashboardLayout";
import InstantPurchaseCard from "@/components/InstantPurchaseCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CreditCard, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const PLAN_OPTIONS = [
  { code: "ten", label: "10回 / 500円" },
  { code: "twentyFour", label: "24回 / 1000円" },
] as const;

const PAYMENT_OPTIONS = [
  { code: "paypay", label: "PayPay" },
  { code: "cash", label: "現金" },
] as const;

export default function PurchasePage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ticket.dashboard.useQuery(undefined, {
    enabled: !!user,
  });
  const historyQuery = trpc.ticket.purchaseHistory.useQuery(undefined, {
    enabled: !!user,
  });

  const [planCode, setPlanCode] = useState<(typeof PLAN_OPTIONS)[number]["code"]>("ten");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_OPTIONS)[number]["code"]>("paypay");
  const [note, setNote] = useState("");

  const selectedPlan = useMemo(() => {
    return (data?.plans ?? []).find(plan => plan.code === planCode) ?? data?.plans?.[0] ?? null;
  }, [data?.plans, planCode]);

  const createPurchaseRequest = trpc.ticket.createPurchaseRequest.useMutation({
    onSuccess: async () => {
      toast.success("購入申請を送信しました。管理者の承認後にチケットが付与されます。");
      setNote("");
      await Promise.all([
        utils.ticket.dashboard.invalidate(),
        utils.ticket.purchaseHistory.invalidate(),
        utils.admin.pendingPurchaseRequests.invalidate(),
      ]);
    },
    onError: error => {
      toast.error(error.message || "購入申請の送信に失敗しました。");
    },
  });

  return (
    <DashboardLayout
      title="チケット購入申請"
      subtitle="研究室内の支払いフローに合わせて、PayPayまたは現金での申請を丁寧に整理できる画面です。"
    >
      <section className="mb-6">
        <InstantPurchaseCard />
      </section>
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Purchase Request</p>
                <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">購入申請フォーム</CardTitle>
              </div>
              <div className="rounded-full bg-stone-900 p-3 text-stone-50">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">申請者</p>
              <Input value={user?.name || ""} disabled className="h-12 rounded-2xl border-stone-200 bg-white/70" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">購入プラン</p>
              <Select value={planCode} onValueChange={value => setPlanCode(value as "ten" | "twentyFour") }>
                <SelectTrigger className="h-12 rounded-2xl border-stone-200 bg-white/70">
                  <SelectValue placeholder="購入プランを選択" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-stone-200 bg-white/95 backdrop-blur">
                  {PLAN_OPTIONS.map(option => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">支払い方法</p>
              <Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as "paypay" | "cash") }>
                <SelectTrigger className="h-12 rounded-2xl border-stone-200 bg-white/70">
                  <SelectValue placeholder="支払い方法を選択" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-stone-200 bg-white/95 backdrop-blur">
                  {PAYMENT_OPTIONS.map(option => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">補足メモ</p>
              <Textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="支払い予定日時や管理者への連絡事項があれば記載してください。"
                className="min-h-32 rounded-2xl border-stone-200 bg-white/70"
              />
            </div>

            <Button
              className="h-12 w-full rounded-full bg-stone-900 text-sm font-medium hover:bg-stone-800"
              disabled={createPurchaseRequest.isPending}
              onClick={() => {
                createPurchaseRequest.mutate({
                  planCode,
                  paymentMethod,
                  note: note.trim() || null,
                });
              }}
            >
              {createPurchaseRequest.isPending ? "申請を送信中..." : "購入申請を送信"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="rounded-[28px] border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,242,235,0.96))] shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Selected Plan</p>
                  <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">申請内容の確認</CardTitle>
                </div>
                <div className="rounded-full bg-amber-100 p-3 text-amber-900">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48 rounded-full" />
                  <Skeleton className="h-5 w-full rounded-full" />
                </div>
              ) : selectedPlan ? (
                <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                  <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 hover:bg-amber-100">承認後に付与</Badge>
                  <h3 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">{selectedPlan.ticketCount}回</h3>
                  <p className="mt-2 text-lg text-stone-700">¥{selectedPlan.priceYen.toLocaleString()}</p>
                  <p className="mt-4 text-sm leading-7 text-stone-600">
                    支払い方法は {paymentMethod === "paypay" ? "PayPay" : "現金"} です。支払い確認後、管理者が手動で承認します。
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/60 bg-white/72 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight text-stone-900">申請履歴</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-[22px]" />
                  <Skeleton className="h-20 rounded-[22px]" />
                </div>
              ) : historyQuery.data?.length ? (
                historyQuery.data.map(request => (
                  <div key={request.id} className="rounded-[22px] border border-stone-200/80 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-stone-900">
                          {request.ticketCount}回 / ¥{request.priceYen.toLocaleString()} / {request.paymentMethod === "paypay" ? "PayPay" : "現金"}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">{new Date(request.requestedAt).toLocaleString()}</p>
                      </div>
                      <Badge
                        className={`rounded-full px-3 py-1 ${
                          request.status === "approved"
                            ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-100"
                            : request.status === "rejected"
                              ? "bg-rose-100 text-rose-900 hover:bg-rose-100"
                              : "bg-amber-100 text-amber-900 hover:bg-amber-100"
                        }`}
                      >
                        {request.status === "approved" ? "承認済み" : request.status === "rejected" ? "却下" : "承認待ち"}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-stone-300/80 bg-white/50 p-6 text-sm leading-7 text-stone-600">
                  まだ申請履歴はありません。必要なプランを選んで最初の申請を送信してください。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardLayout>
  );
}
