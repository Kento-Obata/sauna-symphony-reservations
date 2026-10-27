import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { INSTAGRAM_URL } from "./SiteNav";

const STEPS = [
  {
    latin: "Book",
    title: "オンラインで予約",
    body: "カレンダーから日付と時間帯を選び、人数とお支払い方法を指定します。前日までのご予約を承ります",
  },
  {
    latin: "Confirm",
    title: "予約を確定",
    body: "事前決済なら決済完了と同時に確定。現地払いはSMS・メールのリンクから2時間以内に確定してください",
  },
  {
    latin: "Arrive",
    title: "10分前に受付",
    body: "開始時刻の10分前からご案内します。お車の場合は福岡空港から約30分が目安です",
  },
  {
    latin: "Unwind",
    title: "150分の貸切",
    body: "ご予約のお時間はサウナを貸し切りでご利用いただけます。ご自身のペースでお過ごしください",
  },
];

export const Guide = () => (
  <section id="guide" className="relative scroll-mt-16 bg-u-ink py-24 text-u-paper md:py-36" aria-labelledby="guide-title">
    <div className="u-container">
      <SectionHeading
        tone="light"
        index="05"
        latin="Guide"
        title={<span id="guide-title">ご利用の流れ</span>}
        lead={
          <>
            当日のご予約・ご相談は
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="u-link mx-1 text-u-paper">
              Instagram（@u__sauna）
            </a>
            のDMにて承ります
          </>
        }
      />
      <ol className="mt-16 grid gap-px overflow-hidden rounded-[1.5rem] bg-u-paper/10 md:mt-24 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal as="li" key={s.latin} delay={i * 100} className="group relative bg-u-ink p-7 sm:p-8 lg:min-h-[22rem]">
            <div className="flex items-baseline justify-between">
              <span className="u-num text-sm text-u-paper/60">0{i + 1}</span>
              <span className="u-latin text-lg italic text-u-copper">{s.latin}</span>
            </div>
            {/* ロゴの層を一段ずつ増やして、進行を示す */}
            <div className="mt-6 flex h-12 flex-col justify-end gap-[5px] lg:mt-16" aria-hidden>
              {Array.from({ length: 4 }).map((_, k) => (
                <span
                  key={k}
                  className="block h-px bg-u-paper transition-all duration-700 [transition-timing-function:var(--u-ease)] group-hover:w-full"
                  style={{ width: `${40 + k * 20}%`, opacity: k >= 3 - i ? 0.9 : 0.15 }}
                />
              ))}
            </div>
            <h3 className="u-mincho mt-6 text-xl tracking-[0.12em]">{s.title}</h3>
            <p className="mt-3 text-sm leading-[2] text-u-paper/60">{s.body}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  </section>
);
