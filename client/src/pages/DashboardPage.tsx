import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Coffee, CreditCard, Edit2, QrCode, Ticket } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.name || "");

  const { data, isLoading } = trpc.ticket.dashboard.useQuery(undefined, {
    enabled: !!user,
  });

  const updateNameMutation = trpc.user.updateDisplayName.useMutation({
    onSuccess: async () => {
      toast.success("アカウント名を更新しました。");
      setIsEditingName(false);
      await utils.user.profile.invalidate();
      await utils.auth.me.invalidate();
      await utils.ticket.dashboard.invalidate();
      await utils.admin.usageLogs.invalidate();
    },
    onError: error => {
      toast.error(error.message || "アカウント名の更新に失敗しました。");
    },
  });

  return (
    <DashboardLayout
      title="ダッシュボード"
      subtitle="残チケット枚数と現在提供中のコーヒー豆情報を、研究室の日常動線に沿って見やすく整理しました。"
    >
      {/* アカウント情報セクション */}
      <section className="mb-6">
        <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">アカウント</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">{user?.name || "ユーザー未設定"}</p>
              <p className="mt-1 text-xs text-stone-500">{user?.email}</p>
            </div>
            <Dialog open={isEditingName} onOpenChange={setIsEditingName}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full border-stone-300 bg-white/70">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle>アカウント名を変更</DialogTitle>
                  <DialogDescription>表示されるアカウント名を変更できます。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={newDisplayName}
                    onChange={e => setNewDisplayName(e.target.value)}
                    placeholder="新しいアカウント名"
                    className="h-12 rounded-2xl border-stone-200 bg-white/70"
                  />
                  <Button
                    className="h-12 w-full rounded-full bg-stone-900 hover:bg-stone-800"
                    disabled={updateNameMutation.isPending || !newDisplayName.trim()}
                    onClick={() => {
                      updateNameMutation.mutate({ displayName: newDisplayName.trim() });
                    }}
                  >
                    {updateNameMutation.isPending ? "更新中..." : "アカウント名を更新"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Ticket Balance</p>
                <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
                  現在の残チケット
                </CardTitle>
              </div>
              <div className="rounded-full bg-amber-100 p-3 text-amber-900">
                <Ticket className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-14 w-40 rounded-full" />
                <Skeleton className="h-5 w-full rounded-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-6xl font-semibold tracking-tight text-stone-900">
                    {data?.wallet.balance ?? 0}
                  </span>
                  <span className="pb-2 text-lg text-stone-500">枚</span>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
                  承認済みの購入申請によってチケットが付与され、QR経由で利用するたびに1枚ずつ消費されます。
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button className="rounded-full bg-stone-900 px-6 hover:bg-stone-800" onClick={() => setLocation("/purchase")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    購入申請へ
                  </Button>
                  <Button variant="outline" className="rounded-full border-stone-300 bg-white/60 px-6" onClick={() => setLocation("/use")}>
                    <QrCode className="mr-2 h-4 w-4" />
                    利用ページへ
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,242,235,0.96))] shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Current Bean</p>
                <CardTitle className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
                  提供中のコーヒー豆
                </CardTitle>
              </div>
              <div className="rounded-full bg-stone-900 p-3 text-stone-50">
                <Coffee className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-36 rounded-full" />
                <Skeleton className="h-5 w-full rounded-full" />
                <Skeleton className="h-5 w-2/3 rounded-full" />
              </div>
            ) : data?.activeBean ? (
              <>
                <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100">
                  提供中
                </Badge>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">{data.activeBean.name}</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {data.activeBean.features || "豆の特徴は管理者画面から登録できます。"}
                </p>
                <Separator className="my-5 bg-stone-200/80" />
                <p className="text-sm text-stone-500">価格目安</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">¥{data.activeBean.priceYen.toLocaleString()}</p>
              </>
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300/80 bg-white/50 p-6 text-sm leading-7 text-stone-600">
                現在提供中の豆はまだ登録されていません。管理者が豆情報を登録するとここに反映されます。
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[28px] border-white/60 bg-white/72 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight text-stone-900">購入プラン</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {(data?.plans ?? []).map(plan => (
              <div key={plan.code} className="rounded-[24px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,244,238,0.9))] p-5">
                <p className="text-sm text-stone-500">おすすめプラン</p>
                <h3 className="mt-3 text-2xl font-semibold text-stone-900">{plan.ticketCount}回</h3>
                <p className="mt-2 text-sm leading-7 text-stone-600">研究室内の簡易運用に合わせて、管理者承認後にチケットが反映されます。</p>
                <p className="mt-5 text-lg font-medium text-stone-900">¥{plan.priceYen.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/60 bg-white/72 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight text-stone-900">最近の購入申請</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-[22px]" />
                <Skeleton className="h-20 rounded-[22px]" />
              </div>
            ) : data?.recentRequests.length ? (
              data.recentRequests.map(request => (
                <div key={request.id} className="rounded-[22px] border border-stone-200/80 bg-white/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {request.ticketCount}回 / ¥{request.priceYen.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        申請日時: {new Date(request.requestedAt).toLocaleString()}
                      </p>
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
                まだ購入申請はありません。必要になったら購入申請画面から申請できます。
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardLayout>
  );
}
