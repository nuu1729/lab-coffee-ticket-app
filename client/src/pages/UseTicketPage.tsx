import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Coffee, QrCode, Ticket } from "lucide-react";
import { toast } from "sonner";

export default function UseTicketPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const qrAccessQuery = trpc.ticket.qrAccess.useQuery(undefined, {
    enabled: !!user,
  });

  const consumeMutation = trpc.ticket.consumeViaQr.useMutation({
    onSuccess: async result => {
      toast.success(`チケットを1枚利用しました。残り ${result.balance} 枚です。`);
      await Promise.all([
        utils.ticket.qrAccess.invalidate(),
        utils.ticket.dashboard.invalidate(),
        utils.admin.usageLogs.invalidate(),
        utils.stats.summary.invalidate(),
      ]);
    },
    onError: error => {
      toast.error(error.message || "チケットの利用に失敗しました。");
    },
  });

  return (
    <DashboardLayout
      title="QRコード利用ページ"
      subtitle="コーヒーメーカー横に設置したQRコードからこのURLへアクセスし、利用ボタンを押すだけでチケットを1枚消費できます。"
    >
      <section className="grid gap-5 xl:grid-cols-[1fr_0.92fr]">
        <Card className="rounded-[28px] border-white/60 bg-white/76 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Quick Use</p>
                <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">チケットを利用する</CardTitle>
              </div>
              <div className="rounded-full bg-stone-900 p-3 text-stone-50">
                <QrCode className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {qrAccessQuery.isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-44 rounded-full" />
                <Skeleton className="h-5 w-full rounded-full" />
              </div>
            ) : (
              <>
                <div className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(246,239,231,0.95))] p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-amber-100 p-3 text-amber-900">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-stone-500">現在の残チケット</p>
                      <p className="text-4xl font-semibold tracking-tight text-stone-900">
                        {qrAccessQuery.data?.balance ?? 0}
                        <span className="ml-2 text-lg font-medium text-stone-500">枚</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-stone-600">
                    研究室のコーヒーを淹れる前にボタンを押してください。利用履歴は管理画面へ即時反映されます。
                  </p>
                </div>

                <Button
                  className="mt-6 h-14 w-full rounded-full bg-stone-900 text-base font-medium hover:bg-stone-800"
                  disabled={consumeMutation.isPending || (qrAccessQuery.data?.balance ?? 0) <= 0}
                  onClick={() => consumeMutation.mutate()}
                >
                  {consumeMutation.isPending ? "利用処理を実行中..." : "1杯分のチケットを利用する"}
                </Button>

                {(qrAccessQuery.data?.balance ?? 0) <= 0 ? (
                  <p className="mt-4 text-sm leading-7 text-rose-700">
                    残チケットがありません。購入申請画面から申請し、管理者承認後に再度ご利用ください。
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="rounded-[28px] border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,242,235,0.96))] shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Current Bean</p>
                  <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">本日の豆情報</CardTitle>
                </div>
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-900">
                  <Coffee className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {qrAccessQuery.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-32 rounded-full" />
                  <Skeleton className="h-5 w-full rounded-full" />
                </div>
              ) : qrAccessQuery.data?.activeBean ? (
                <>
                  <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100">提供中</Badge>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">{qrAccessQuery.data.activeBean.name}</h3>
                  <p className="mt-3 text-sm leading-7 text-stone-600">
                    {qrAccessQuery.data.activeBean.features || "管理者が豆の特徴を登録すると、ここに表示されます。"}
                  </p>
                  <p className="mt-5 text-sm text-stone-500">価格目安</p>
                  <p className="mt-2 text-lg font-medium text-stone-900">
                    ¥{qrAccessQuery.data.activeBean.priceYen.toLocaleString()}
                  </p>
                </>
              ) : (
                <div className="rounded-[24px] border border-dashed border-stone-300/80 bg-white/50 p-6 text-sm leading-7 text-stone-600">
                  まだ豆情報が登録されていません。管理者画面から提供中の豆を設定してください。
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/60 bg-white/72 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-tight text-stone-900">運用メモ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-stone-600">
              <p>このページのURLをQRコード化してコーヒーメーカー横に掲示すれば、スマートフォンからすぐに利用処理へ進めます。</p>
              <p>支払いは自動決済ではなく、PayPay送金または現金投入を管理者が目視確認した後に承認する前提です。</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardLayout>
  );
}
