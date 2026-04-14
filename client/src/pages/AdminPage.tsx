import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import QrCodeDisplay from "@/components/QrCodeDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BarChart3, Coffee, Copy, QrCode, ShieldCheck, Ticket, UserCog, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[24px] border border-dashed border-stone-300/80 bg-white/50 p-6 text-sm leading-7 text-stone-600">{text}</div>;
}

export default function AdminPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedQrCode, setSelectedQrCode] = useState<{ id: number; code: string; accessUrl: string } | null>(null);

  const pendingQuery = trpc.admin.pendingPurchaseRequests.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const beansQuery = trpc.admin.coffeeBeans.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const logsQuery = trpc.admin.usageLogs.useQuery(
    { limit: 100 },
    {
      enabled: user?.role === "admin",
    }
  );
  const statsQuery = trpc.stats.summary.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const qrCodesQuery = trpc.admin.qrCodes.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const userUsageStatsQuery = trpc.admin.userUsageStats.useQuery(undefined, {
    enabled: !!user, // Allow all authenticated users
  });
  const testAccountsQuery = trpc.admin.testAccounts.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // ユーザー名の重複をチェック
  const duplicateUsernames = useMemo(() => {
    if (!userUsageStatsQuery.data) return new Set();
    const nameCount = new Map<string, number>();
    userUsageStatsQuery.data.forEach(stat => {
      const displayName = stat.displayName || stat.userName;
      if (displayName) {
        nameCount.set(displayName, (nameCount.get(displayName) || 0) + 1);
      }
    });
    return new Set(Array.from(nameCount.entries()).filter(([, count]) => count > 1).map(([name]) => name));
  }, [userUsageStatsQuery.data]);

  const [editingBeanId, setEditingBeanId] = useState<number | undefined>(undefined);
  const [editingTicketUserId, setEditingTicketUserId] = useState<number | undefined>(undefined);
  const [editingTicketAmount, setEditingTicketAmount] = useState<number>(0);
  const [showTicketEditDialog, setShowTicketEditDialog] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [beanName, setBeanName] = useState("");
  const [beanFeatures, setBeanFeatures] = useState("");
  const [beanPriceYen, setBeanPriceYen] = useState("0");
  const [beanIsActive, setBeanIsActive] = useState(true);

  const approveMutation = trpc.admin.approvePurchaseRequest.useMutation({
    onSuccess: async () => {
      toast.success("購入申請を承認し、チケットを付与しました。");
      await Promise.all([
        utils.admin.pendingPurchaseRequests.invalidate(),
        utils.ticket.dashboard.invalidate(),
        utils.ticket.purchaseHistory.invalidate(),
        utils.stats.summary.invalidate(),
      ]);
    },
    onError: error => {
      toast.error(error.message || "購入申請の承認に失敗しました。");
    },
  });

  const saveBeanMutation = trpc.admin.saveCoffeeBean.useMutation({
    onSuccess: async () => {
      toast.success("コーヒー豆情報を保存しました。");
      await Promise.all([utils.admin.coffeeBeans.invalidate(), utils.ticket.dashboard.invalidate(), utils.ticket.qrAccess.invalidate()]);
      setEditingBeanId(undefined);
      setBeanName("");
      setBeanFeatures("");
      setBeanPriceYen("0");
      setBeanIsActive(true);
    },
    onError: error => {
      toast.error(error.message || "豆情報の保存に失敗しました。");
    },
  });

  const deleteBeanMutation = trpc.admin.deleteCoffeeBean.useMutation({
    onSuccess: async () => {
      toast.success("コーヒー豆を削除しました。");
      await Promise.all([utils.admin.coffeeBeans.invalidate(), utils.ticket.dashboard.invalidate(), utils.ticket.qrAccess.invalidate()]);
    },
    onError: error => {
      toast.error(error.message || "豆情報の削除に失敗しました。");
    },
  });

  const updateUserRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: async () => {
      toast.success("ユーザー権限を更新しました。");
      await utils.admin.userUsageStats.invalidate();
    },
    onError: error => {
      toast.error(error.message || "ユーザー権限の更新に失敗しました。");
    },
  });

  const updateTicketBalanceMutation = trpc.admin.updateTicketBalance.useMutation({
    onSuccess: async () => {
      toast.success("チケット枚数を更新しました。");
      await utils.admin.userUsageStats.invalidate();
      setShowTicketEditDialog(false);
    },
    onError: error => {
      toast.error(error.message || "チケット枚数の更新に失敗しました。");
    },
  });

  const generateQrMutation = trpc.admin.generateQrCode.useMutation({
    onSuccess: async (data) => {
      toast.success("QRコードを生成しました。");
      await utils.admin.qrCodes.invalidate();
      // QRコードをクリップボードにコピー
      navigator.clipboard.writeText(data.accessUrl);
      toast.success("アクセスURLをコピーしました。");
    },
    onError: error => {
      toast.error(error.message || "QRコード生成に失敗しました。");
    },
  });

  const deactivateQrMutation = trpc.admin.deactivateQrCode.useMutation({
    onSuccess: async () => {
      toast.success("QRコードを無効化しました。");
      await utils.admin.qrCodes.invalidate();
    },
    onError: error => {
      toast.error(error.message || "QRコード無効化に失敗しました。");
    },
  });

  const createTestAccountsMutation = trpc.admin.createTestAccounts.useMutation({
    onSuccess: (data) => {
      toast.success("テストアカウントを作成しました。");
      const accountInfo = `管理者: ${data.adminAccount.name} (${data.adminAccount.email})\nユーザー: ${data.userAccount.name} (${data.userAccount.email})`;
      navigator.clipboard.writeText(accountInfo);
      toast.success("アカウント情報をコピーしました。");
      utils.admin.testAccounts.invalidate();
    },
    onError: error => {
      toast.error(error.message || "テストアカウント作成に失敗しました。");
    },
  });

  const deleteTestAccountsMutation = trpc.admin.deleteTestAccounts.useMutation({
    onSuccess: () => {
      toast.success("テストアカウントを削除しました。");
      utils.admin.testAccounts.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "テストアカウント削除に失敗しました。");
    },
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("ユーザーを削除しました。");
      utils.admin.userUsageStats.invalidate();
      utils.admin.usageLogs.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "ユーザー削除に失敗しました。");
    },
  });

  const activeBean = useMemo(() => beansQuery.data?.find(bean => bean.isActive === 1) ?? null, [beansQuery.data]);
  const uniqueUserCount = useMemo(() => new Set((logsQuery.data ?? []).map(log => log.userId)).size, [logsQuery.data]);
  const recentUsageCount = logsQuery.data?.length ?? 0;

  if (user && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <DashboardLayout
      title="管理画面"
      subtitle="購入申請の手動承認、提供豆の更新、利用履歴の確認、QRコード管理、テストアカウント作成を一つの画面に集約しています。"
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={ShieldCheck} title="未承認申請" value={`${pendingQuery.data?.length ?? statsQuery.data?.totalPendingRequests ?? 0}件`} helper="支払い確認後に承認" />
        <SummaryCard icon={Coffee} title="提供中の豆" value={activeBean?.name ?? statsQuery.data?.activeBean?.name ?? "未設定"} helper="ダッシュボードへ反映" />
        <SummaryCard icon={Ticket} title="累計利用回数" value={`${statsQuery.data?.totalConsumptions ?? 0}回`} helper="統計APIから算出" />
        <SummaryCard icon={BarChart3} title="ユニーク利用者" value={`${uniqueUserCount}名`} helper="利用ログから集計" />
      </section>

      <Tabs defaultValue="requests" className="space-y-5">
        <TabsList className="h-auto flex-wrap rounded-[24px] border border-white/60 bg-white/70 p-2 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <TabsTrigger value="requests" className="rounded-2xl px-4 py-2.5">購入申請承認</TabsTrigger>
          <TabsTrigger value="beans" className="rounded-2xl px-4 py-2.5">豆情報管理</TabsTrigger>
          <TabsTrigger value="qr" className="rounded-2xl px-4 py-2.5">QRコード管理</TabsTrigger>
          <TabsTrigger value="test" className="rounded-2xl px-4 py-2.5">テストアカウント</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-2xl px-4 py-2.5">利用ログ</TabsTrigger>
          <TabsTrigger value="users" className="rounded-2xl px-4 py-2.5">利用者一覧</TabsTrigger>
          <TabsTrigger value="stats" className="rounded-2xl px-4 py-2.5">統計API概要</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">未承認の購入申請</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-[22px]" />
                  <Skeleton className="h-24 rounded-[22px]" />
                </div>
              ) : pendingQuery.data?.length ? (
                pendingQuery.data.map(request => (
                  <div key={request.id} className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-stone-900">{request.displayName || request.requesterName || "ユーザー未設定"}</p>
                          <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 hover:bg-amber-100">承認待ち</Badge>
                        </div>
                        <p className="mt-2 text-sm text-stone-600">
                          {request.ticketCount}回 / ¥{request.priceYen.toLocaleString()} / {request.paymentMethod === "paypay" ? "PayPay" : "現金"}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">申請日時: {new Date(request.requestedAt).toLocaleString()}</p>
                        {request.note ? <p className="mt-3 text-sm leading-7 text-stone-600">備考: {request.note}</p> : null}
                      </div>
                      <Button
                        className="rounded-full bg-stone-900 px-6 hover:bg-stone-800"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate({ requestId: request.id })}
                      >
                        チケットを付与して承認
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="現在、承認待ちの購入申請はありません。" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="beans">
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">豆情報の登録・更新</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-700">豆の名前</p>
                  <Input value={beanName} onChange={event => setBeanName(event.target.value)} className="h-12 rounded-2xl border-stone-200 bg-white/70" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-700">特徴</p>
                  <Textarea value={beanFeatures} onChange={event => setBeanFeatures(event.target.value)} className="min-h-32 rounded-2xl border-stone-200 bg-white/70" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-700">価格</p>
                  <Input value={beanPriceYen} onChange={event => setBeanPriceYen(event.target.value)} className="h-12 rounded-2xl border-stone-200 bg-white/70" inputMode="numeric" />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/70 px-4 py-3 text-sm text-stone-700">
                  <input type="checkbox" checked={beanIsActive} onChange={event => setBeanIsActive(event.target.checked)} />
                  この豆を現在提供中として表示する
                </label>
                <Button
                  className="h-12 w-full rounded-full bg-stone-900 hover:bg-stone-800"
                  disabled={saveBeanMutation.isPending || !beanName.trim()}
                  onClick={() => {
                    saveBeanMutation.mutate({
                      id: editingBeanId,
                      name: beanName.trim(),
                      features: beanFeatures.trim() || null,
                      priceYen: Number(beanPriceYen || 0),
                      isActive: beanIsActive ? 1 : 0,
                    });
                  }}
                >
                  {saveBeanMutation.isPending ? "保存中..." : editingBeanId ? "豆情報を更新" : "新しい豆情報を登録"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-white/60 bg-white/72 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">登録済みの豆</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {beansQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 rounded-[22px]" />
                    <Skeleton className="h-24 rounded-[22px]" />
                  </div>
                ) : beansQuery.data?.length ? (
                  beansQuery.data.map(bean => (
                    <div key={bean.id} className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-stone-900">{bean.name}</p>
                            {bean.isActive === 1 ? (
                              <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100">提供中</Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-7 text-stone-600">{bean.features || "特徴は未登録です。"}</p>
                          <p className="mt-2 text-sm text-stone-500">価格: ¥{bean.priceYen.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="rounded-full border-stone-300 bg-white/70"
                            onClick={() => {
                              setEditingBeanId(bean.id);
                              setBeanName(bean.name);
                              setBeanFeatures(bean.features || "");
                              setBeanPriceYen(String(bean.priceYen));
                              setBeanIsActive(bean.isActive === 1);
                            }}
                          >
                            編集
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="rounded-full"
                                disabled={deleteBeanMutation.isPending}
                              >
                                ×
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>豆を削除しますか?</DialogTitle>
                                <DialogDescription>
                                  「{bean.name}」を削除します。この操作は取り消せません。
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex gap-3 justify-end">
                                <DialogClose asChild>
                                  <Button variant="outline" className="rounded-full">キャンセル</Button>
                                </DialogClose>
                                <Button
                                  variant="destructive"
                                  className="rounded-full"
                                  disabled={deleteBeanMutation.isPending}
                                  onClick={() => {
                                    deleteBeanMutation.mutate({ beanId: bean.id });
                                  }}
                                >
                                  削除する
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState text="まだ豆情報は登録されていません。最初の提供豆を登録してください。" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="qr">
          <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">QRコード管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                <p className="mb-4 text-sm text-stone-600">新しいQRコードを生成します。生成されたURLをQRコード化して設置してください。</p>
                <Button
                  className="rounded-full bg-stone-900 px-6 hover:bg-stone-800"
                  disabled={generateQrMutation.isPending}
                  onClick={() => {
                    const baseUrl = window.location.origin;
                    generateQrMutation.mutate({ baseUrl });
                  }}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {generateQrMutation.isPending ? "生成中..." : "新しいQRコードを生成"}
                </Button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-700">アクティブなQRコード</p>
                {qrCodesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 rounded-[22px]" />
                    <Skeleton className="h-20 rounded-[22px]" />
                  </div>
                ) : qrCodesQuery.data?.length ? (
                  qrCodesQuery.data.map(qr => (
                    <div key={qr.id} className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-mono text-stone-600">コード: {qr.code}</p>
                          <p className="mt-2 break-all text-xs text-stone-500">{qr.accessUrl}</p>
                          <p className="mt-2 text-xs text-stone-500">生成日時: {new Date(qr.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-stone-300 bg-white/70"
                            onClick={() => setSelectedQrCode({ id: qr.id, code: qr.code, accessUrl: qr.accessUrl })}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-stone-300 bg-white/70"
                            onClick={() => {
                              navigator.clipboard.writeText(qr.accessUrl);
                              toast.success("URLをコピーしました。");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                            disabled={deactivateQrMutation.isPending}
                            onClick={() => deactivateQrMutation.mutate({ codeId: qr.id })}
                          >
                            無効化
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState text="アクティブなQRコードはありません。新しく生成してください。" />
                )}
              </div>
              {selectedQrCode && (
                <div className="mt-6 rounded-[24px] border border-stone-200/80 bg-stone-50/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-stone-900">QRコード表示</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedQrCode(null)}
                      className="h-6 w-6 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                  <QrCodeDisplay qrCode={selectedQrCode.code} accessUrl={selectedQrCode.accessUrl} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test">
          <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">テストアカウント</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/50 p-5">
                <p className="text-sm text-amber-900">
                  テストアカウント（管理者・一般ユーザー）を作成します。これらのアカウントでの購入申請は無料でチケットが自動付与されます。
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  className="rounded-full bg-stone-900 px-6 hover:bg-stone-800"
                  disabled={createTestAccountsMutation.isPending}
                  onClick={() => createTestAccountsMutation.mutate()}
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  {createTestAccountsMutation.isPending ? "作成中..." : "テストアカウントを作成"}
                </Button>
                {testAccountsQuery.data?.length ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="rounded-full px-6">
                        一括削除
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>テストアカウントを削除しますか？</DialogTitle>
                        <DialogDescription>
                          すべてのテストアカウント（{testAccountsQuery.data.length}件）と関連データが削除されます。この操作は取り消せません。
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex gap-3 justify-end">
                        <DialogClose asChild>
                          <Button variant="outline" className="rounded-full">キャンセル</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          className="rounded-full"
                          disabled={deleteTestAccountsMutation.isPending}
                          onClick={() => deleteTestAccountsMutation.mutate()}
                        >
                          {deleteTestAccountsMutation.isPending ? "削除中..." : "削除"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
              {testAccountsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-[22px]" />
                  <Skeleton className="h-20 rounded-[22px]" />
                </div>
              ) : testAccountsQuery.data?.length ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-stone-900">利用中のテストアカウント</h3>
                  {testAccountsQuery.data.map(account => (
                    <div key={account.id} className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-base font-semibold text-stone-900">{account.displayName || account.name}</p>
                          <p className="text-sm text-stone-600">{account.email}</p>
                          <p className="mt-1 text-xs text-stone-500">役割: {account.role === "admin" ? "管理者" : "ユーザー"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="テストアカウントはまだ作成されていません。" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">利用ログ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {logsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-[22px]" />
                  <Skeleton className="h-20 rounded-[22px]" />
                </div>
              ) : logsQuery.data?.length ? (
                logsQuery.data.map(log => (
                  <div key={log.id} className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-stone-900">{log.displayName || log.userName || "ユーザー未設定"}</p>
                        <p className="mt-1 text-xs text-stone-500">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 hover:bg-emerald-100">利用</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="まだ利用ログはありません。" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">利用者一覧</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicateUsernames.size > 0 && (
                <div className="rounded-[24px] border border-red-200/80 bg-red-50/50 p-4">
                  <p className="text-sm font-semibold text-red-900">⚠️ ユーザー名の重複が検出されました</p>
                  <p className="mt-1 text-xs text-red-700">以下のユーザー名が複数のアカウントで使用されています: {Array.from(duplicateUsernames).join(", ")}</p>
                </div>
              )}
              {userUsageStatsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-[22px]" />
                  <Skeleton className="h-20 rounded-[22px]" />
                </div>
              ) : userUsageStatsQuery.data?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200/80">
                        <th className="px-4 py-3 text-left font-semibold text-stone-900">ユーザー名</th>
                        <th className="px-4 py-3 text-left font-semibold text-stone-900">メール</th>
                        <th className="px-4 py-3 text-center font-semibold text-stone-900">合計利用回数</th>
                        <th className="px-4 py-3 text-center font-semibold text-stone-900">購入枚数</th>
                        <th className="px-4 py-3 text-center font-semibold text-stone-900">現在残量</th>
                        <th className="px-4 py-3 text-center font-semibold text-stone-900">権限</th>
                        <th className="px-4 py-3 text-center font-semibold text-stone-900"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {userUsageStatsQuery.data.map(stat => {
                        const displayName = stat.displayName || stat.userName;
                        const isDuplicate = displayName && duplicateUsernames.has(displayName);
                        return (
                        <tr key={stat.userId} className={`border-b border-stone-100/80 hover:bg-stone-50/50 ${isDuplicate ? "bg-red-50/30" : ""}`}>
                          <td className={`px-4 py-3 font-medium ${isDuplicate ? "text-red-900" : "text-stone-900"}`}>{displayName || "ユーザー未設定"}</td>
                          <td className="px-4 py-3 text-xs text-stone-600">{stat.userEmail}</td>
                          <td className="px-4 py-3 text-center text-stone-900">{stat.totalConsumptions}</td>
                          <td className="px-4 py-3 text-center text-stone-900">{stat.totalPurchasedTickets}</td>
                          <td className="px-4 py-3 text-center font-semibold text-stone-900">
                            {user?.role === "admin" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  setEditingTicketUserId(stat.userId);
                                  setEditingTicketAmount(stat.currentBalance);
                                  setShowTicketEditDialog(true);
                                }}
                              >
                                {stat.currentBalance}
                              </Button>
                            ) : (
                              stat.currentBalance
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <select
                              value={stat.role || "user"}
                              onChange={(e) => {
                                updateUserRoleMutation.mutate({ userId: stat.userId, role: e.target.value as "admin" | "user" });
                              }}
                              disabled={updateUserRoleMutation.isPending}
                              className="rounded border border-stone-200 px-2 py-1 text-xs"
                            >
                              <option value="user">ユーザー</option>
                              <option value="admin">管理者</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                                  ×
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>ユーザーを削除しますか？</DialogTitle>
                                  <DialogDescription>
                                    {displayName || "ユーザー"}を削除します。この操作は取り消せません。
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="flex gap-3 justify-end">
                                  <DialogClose asChild>
                                    <Button variant="outline" className="rounded-full">キャンセル</Button>
                                  </DialogClose>
                                  <Button
                                    variant="destructive"
                                    className="rounded-full"
                                    disabled={deleteUserMutation.isPending}
                                    onClick={() => deleteUserMutation.mutate({ userId: stat.userId })}
                                  >
                                    {deleteUserMutation.isPending ? "削除中..." : "削除"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState text="まだ一般ユーザーはいません。" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ticket Edit Dialog */}
        <Dialog open={showTicketEditDialog} onOpenChange={setShowTicketEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>チケット枚数を編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-stone-700">新しいチケット枚数</label>
                <input
                  type="number"
                  min="0"
                  value={editingTicketAmount}
                  onChange={(e) => setEditingTicketAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <DialogClose asChild>
                <Button variant="outline" className="rounded-full">キャンセル</Button>
              </DialogClose>
              <Button
                className="rounded-full"
                disabled={updateTicketBalanceMutation.isPending}
                onClick={() => {
                  if (editingTicketUserId) {
                    updateTicketBalanceMutation.mutate({
                      userId: editingTicketUserId,
                      newBalance: editingTicketAmount,
                    });
                  }
                }}
              >
                {updateTicketBalanceMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="stats">
          <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold tracking-tight text-stone-900">統計API概要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[24px] border border-blue-200/80 bg-blue-50/50 p-5">
                <p className="text-sm text-blue-900">
                  統計APIエンドポイント <code className="font-mono text-xs">trpc.stats.summary</code> は、利用状況の集計データを返します。将来のグラフ化に向けて、このAPIを基盤に拡張できます。
                </p>
              </div>
              {statsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-[22px]" />
                  <Skeleton className="h-20 rounded-[22px]" />
                </div>
              ) : statsQuery.data ? (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                    <p className="text-xs text-stone-600">累計利用回数</p>
                    <p className="mt-2 text-3xl font-bold text-stone-900">{statsQuery.data.totalConsumptions}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                    <p className="text-xs text-stone-600">累計付与チケット</p>
                    <p className="mt-2 text-3xl font-bold text-stone-900">{statsQuery.data.totalGrantedTickets}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                    <p className="text-xs text-stone-600">未承認申請数</p>
                    <p className="mt-2 text-3xl font-bold text-stone-900">{statsQuery.data.totalPendingRequests}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5">
                    <p className="text-xs text-stone-600">提供中の豆</p>
                    <p className="mt-2 text-lg font-semibold text-stone-900">{statsQuery.data.activeBean?.name || "未設定"}</p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-stone-200/80 bg-white/80 p-5 mt-3">
                  <p className="text-xs font-semibold text-stone-600 mb-3">利用回数上位3名</p>
                  {userUsageStatsQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6" />
                      <Skeleton className="h-6" />
                      <Skeleton className="h-6" />
                    </div>
                  ) : userUsageStatsQuery.data && userUsageStatsQuery.data.length > 0 ? (
                    <div className="space-y-2">
                      {userUsageStatsQuery.data
                        .sort((a, b) => b.totalConsumptions - a.totalConsumptions)
                        .slice(0, 3)
                        .map((stat, index) => {
                          const displayName = stat.displayName || stat.userName;
                          return (
                            <div key={stat.userId} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-stone-900">{index + 1}. {displayName || "ユーザー未設定"}</span>
                              <span className="text-stone-600">{stat.totalConsumptions}回</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">データなし</p>
                  )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function SummaryCard({ icon: Icon, title, value, helper }: { icon: any; title: string; value: string; helper: string }) {
  return (
    <Card className="rounded-[28px] border-white/60 bg-white/75 shadow-[0_18px_60px_rgba(67,44,24,0.08)] backdrop-blur-xl">
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="rounded-2xl bg-stone-100 p-3">
          <Icon className="h-6 w-6 text-stone-700" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-600">{title}</p>
          <p className="mt-2 text-2xl font-bold text-stone-900">{value}</p>
          <p className="mt-1 text-xs text-stone-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}


