import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>利用規約</DialogTitle>
        </DialogHeader>
        <ScrollArea 
          ref={scrollRef} 
          onScrollCapture={handleScroll}
          className="h-[50vh] pr-4"
        >
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">第1条（適用）</h3>
            <p>本規約は、当施設（以下「当社」といいます。）が提供するサウナサービス（以下「本サービス」といいます。）の利用に関する条件を、本サービスを利用するお客様（以下「利用者」といいます。）と当社との間で定めるものです。</p>

            <h3 className="text-lg font-semibold">第2条（利用規約の変更）</h3>
            <p>当社は、本規約を随時変更することができるものとします。変更後の利用規約は、当社が別途定める場合を除いて、本ウェブサイト上に表示した時点より効力を生じるものとします。</p>

            <h3 className="text-lg font-semibold">第3条（予約・キャンセル）</h3>
            <p>1. 予約は本ウェブサイトを通じて行うものとします。</p>
            <p>2. キャンセルは予約時間の2日前までに行うものとします。</p>
            <p>3. 上記期限を過ぎてのキャンセルについては、キャンセル料が発生する場合があります。</p>

            <h3 className="text-lg font-semibold">キャンセルポリシーについて</h3>
            <p>ご予約のキャンセルにつきましては、以下の通りキャンセル料を申し受けます。</p>
            <p>• ご利用日の 2日前まで：無料</p>
            <p>• ご利用日の 24時間前まで：料金の30%</p>
            <p>• ご利用日の 24時間以内：料金の100%</p>
            <p>• 無断キャンセル：料金の100%</p>
            <p>上記キャンセルポリシーに同意のうえ、ご予約をお願いいたします。</p>

            <h3 className="text-lg font-semibold">第4条（利用料金）</h3>
            <p>1. 利用料金は本ウェブサイトに表示された金額とします。</p>
            <p>2. 支払方法は当社が指定する方法によるものとします。</p>

            <h3 className="text-lg font-semibold">第5条（禁止事項）</h3>
            <p>利用者は、以下の行為を行ってはならないものとします：</p>
            <p>1. 他の利用者に迷惑をかける行為</p>
            <p>2. 施設・設備を故意に損壊する行為</p>
            <p>3. 法令または公序良俗に反する行為</p>

            <h3 className="text-lg font-semibold">第6条（免責事項）</h3>
            <p>当社は、以下の事項について一切の責任を負わないものとします：</p>
            <p>1. 利用者の故意または過失により生じた損害</p>
            <p>2. 天災地変その他の不可抗力により生じた損害</p>

            <h3 className="text-lg font-semibold">第7条（個人情報の取り扱い）</h3>
            <p>当社は、利用者の個人情報を適切に管理し、法令に基づく場合を除き、利用者の同意なく第三者に提供することはありません。</p>

            <h3 className="text-lg font-semibold">第8条（準拠法・管轄裁判所）</h3>
            <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。</p>
          </div>
        </ScrollArea>
        <div className="flex items-center space-x-2 pt-4">
          <Checkbox
            id="terms"
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={!canCheck}
          />
          <label
            htmlFor="terms"
            className={`text-sm ${!canCheck ? 'text-muted-foreground' : ''}`}
          >
            {canCheck ? (
              "利用規約に同意する"
            ) : (
              "利用規約を最後までお読みください"
            )}
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
};