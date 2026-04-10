import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Coffee, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { Redirect } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(115,79,52,0.18),_transparent_28%),linear-gradient(180deg,_#f8f3ec_0%,_#f1e9de_52%,_#eee3d7_100%)] text-stone-900">
      <div className="container relative flex min-h-screen flex-col justify-between py-8 md:py-12">
        <header className="flex items-center justify-between gap-4 rounded-full border border-white/50 bg-white/70 px-5 py-3 shadow-[0_18px_50px_rgba(67,44,24,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-stone-900 p-2 text-stone-50">
              <Coffee className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Lab Brew</p>
              <p className="text-sm font-semibold tracking-tight">Coffee Ticket Service</p>
            </div>
          </div>
          <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 hover:bg-amber-100">研究室向け内部運用</Badge>
        </header>

        <main className="grid items-center gap-8 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
          <section>
            <Badge className="rounded-full border border-stone-200/80 bg-white/80 px-4 py-2 text-stone-700 hover:bg-white/80">
              手動承認で安心して運用できるコーヒーチケット管理
            </Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
              研究室のコーヒー運用を、
              <span className="block text-stone-700">静かに、美しく、迷いなく整える。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 md:text-lg">
              Manus OAuthによるログイン、購入申請、QRコード利用、管理者承認、豆情報管理、利用ログ確認までを、上品で見通しの良いUIにまとめた研究室専用サービスです。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="h-12 rounded-full bg-stone-900 px-7 text-sm font-medium text-white shadow-[0_16px_30px_rgba(41,28,18,0.16)] hover:bg-stone-800"
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
              >
                Manus OAuthでログイン
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-full border-stone-300 bg-white/75 px-7">
                QR利用ページは /use
              </Button>
            </div>
          </section>

          <Card className="rounded-[32px] border-white/60 bg-white/74 shadow-[0_24px_80px_rgba(67,44,24,0.1)] backdrop-blur-xl">
            <CardContent className="grid gap-4 p-6 md:p-7">
              <FeatureCard
                icon={Ticket}
                title="残枚数の即時把握"
                text="ダッシュボードで残チケットと最近の購入申請を一目で確認できます。"
              />
              <FeatureCard
                icon={QrCode}
                title="QRコード経由の利用"
                text="コーヒーメーカー横のQRから利用画面へアクセスし、その場で1枚消費できます。"
              />
              <FeatureCard
                icon={ShieldCheck}
                title="管理者による手動承認"
                text="PayPay送金や現金投入の目視確認後に、管理者が安全にチケットを付与します。"
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Coffee;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,242,235,0.92))] p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-amber-100 p-3 text-amber-900">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600">{text}</p>
        </div>
      </div>
    </div>
  );
}
