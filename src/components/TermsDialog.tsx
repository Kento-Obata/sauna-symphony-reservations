import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface TermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const TermsDialog = ({
  open,
  onOpenChange,
  checked,
  onCheckedChange,
}: TermsDialogProps) => {
  const [canCheck, setCanCheck] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 本文の末尾まで表示されたら同意できるようにする(ホイール以外のキーボード操作でも有効)
  useEffect(() => {
    if (!open) return;
    let io: IntersectionObserver | null = null;
    const t = window.setTimeout(() => {
      if (!endRef.current) return;
      io = new IntersectionObserver(([e]) => e.isIntersecting && setCanCheck(true), { threshold: 1 });
      io.observe(endRef.current);
    }, 100);
    return () => {
      window.clearTimeout(t);
      io?.disconnect();
    };
  }, [open]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;
      if (isAtBottom) {
        setCanCheck(true);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      setCanCheck(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-u-ink/50 backdrop-blur-sm"
        className="u-site w-[calc(100%-1.5rem)] max-w-2xl gap-0 rounded-[1.75rem] border-0 bg-u-paper p-0 shadow-[0_40px_120px_-30px_rgba(27,28,25,0.6)] sm:rounded-[1.75rem] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-transparent [&>button[data-state=open]]:bg-transparent [&>button[data-state=open]]:text-u-ink [&>button:hover]:bg-u-ink/5 [&>button:focus]:ring-0 [&>button:focus-visible]:ring-2 [&>button:focus-visible]:ring-u-ink/30 [&>button:focus-visible]:ring-offset-0"
      >
        <DialogHeader className="p-6 pb-4 text-left sm:p-8 sm:pb-5">
          <p className="u-latin text-sm italic text-u-ink/65">Terms</p>
          <DialogTitle className="u-mincho text-xl font-medium tracking-[0.12em]">利用規約</DialogTitle>
          <DialogDescription className="text-xs text-u-ink/65">最後までお読みいただくと、同意できるようになります</DialogDescription>
        </DialogHeader>
        <ScrollArea 
          ref={scrollRef} 
          onScrollCapture={handleScroll}
          className="h-[52svh] border-y border-u-ink/10 px-6 sm:px-8"
        >
          <div
            tabIndex={0}
            aria-label="利用規約の本文"
            className="space-y-3 py-6 text-sm outline-none leading-[2] text-u-ink/80 [&_h3]:u-mincho [&_h3]:pt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3]:tracking-[0.08em] [&_h3]:text-u-ink first:[&_h3]:pt-0"
          >
            <h3>第1条（適用）</h3>
            <p>本規約は、当施設（以下「当社」といいます。）が提供するサウナサービス（以下「本サービス」といいます。）の利用に関する条件を、本サービスを利用するお客様（以下「利用者」といいます。）と当社との間で定めるものです。</p>

            <h3>第2条（利用規約の変更）</h3>
            <p>当社は、本規約を随時変更することができるものとします。変更後の利用規約は、当社が別途定める場合を除いて、本ウェブサイト上に表示した時点より効力を生じるものとします。</p>

            <h3>第3条（予約・キャンセル）</h3>
            <p>1. 予約は本ウェブサイトを通じて行うものとします。</p>
            <p>2. キャンセルは予約時間の2日前までに行うものとします。</p>
            <p>3. 上記期限を過ぎてのキャンセルについては、キャンセル料が発生する場合があります。</p>

            <h3>キャンセルポリシーについて</h3>
            <p>ご予約のキャンセルにつきましては、以下の通りキャンセル料を申し受けます。</p>
            <p>• ご利用日の 2日前まで：無料</p>
            <p>• ご利用日の 24時間前まで：料金の30%</p>
            <p>• ご利用日の 24時間以内：料金の100%</p>
            <p>• 無断キャンセル：料金の100%</p>
            <p>上記キャンセルポリシーに同意のうえ、ご予約をお願いいたします。</p>

            <h3>第4条（利用料金）</h3>
            <p>1. 利用料金は本ウェブサイトに表示された金額とします。</p>
            <p>2. 支払方法は当社が指定する方法によるものとします。</p>

            <h3>第5条（禁止事項）</h3>
            <p>利用者は、以下の行為を行ってはならないものとします：</p>
            <p>1. 他の利用者に迷惑をかける行為</p>
            <p>2. 施設・設備を故意に損壊する行為</p>
            <p>3. 法令または公序良俗に反する行為</p>

            <h3>第6条（免責事項）</h3>
            <p>当社は、以下の事項について一切の責任を負わないものとします：</p>
            <p>1. 利用者の故意または過失により生じた損害</p>
            <p>2. 天災地変その他の不可抗力により生じた損害</p>

            <h3>第7条（個人情報の取り扱い）</h3>
            <p>当社は、利用者の個人情報を適切に管理し、法令に基づく場合を除き、利用者の同意なく第三者に提供することはありません。</p>

            <h3>第8条（準拠法・管轄裁判所）</h3>
            <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
          </div>
            <div ref={endRef} aria-hidden className="h-px" />
        </ScrollArea>
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <label
            htmlFor="terms-agree"
            className={`flex cursor-pointer items-center gap-3 text-sm ${!canCheck ? "cursor-not-allowed text-u-ink/65" : ""}`}
          >
            <Checkbox
              id="terms-agree"
              checked={checked}
              onCheckedChange={(v) => onCheckedChange(v === true)}
              disabled={!canCheck}
              className="h-5 w-5 rounded-md border-u-ink/40 data-[state=checked]:border-u-ink data-[state=checked]:bg-u-ink data-[state=checked]:text-u-paper"
            />
            {canCheck ? "利用規約に同意する" : "最後までスクロールしてください"}
          </label>
          <button
            type="button"
            disabled={!checked}
            onClick={() => onOpenChange(false)}
            className="u-btn u-btn-primary !min-h-[2.75rem]"
          >
            同意して閉じる
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};