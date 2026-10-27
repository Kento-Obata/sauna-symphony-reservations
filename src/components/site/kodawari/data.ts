// 「体験型サウナ U のこだわり」9項目。番号は並び順から振る
// 文章は U_kodawari_assets/content/kodawari.json のまま
export interface KodawariItem {
  no: number;
  slug: string;
  title: string;
  latin: string;
  body: string;
  /** public/kodawari/{photo}-{800|1600}.webp。無い項目(非公開の体験)は「?」の図を出す */
  photo?: { name: string; alt: string; ratio: number };
  /** 本文中の数字を大きく見せる */
  figure?: { value: string; unit: string; caption: string };
  /** 詳細ページでの写真の組み方 */
  layout: "portrait" | "landscape" | "wide";
}

export const KODAWARI: KodawariItem[] = (
  [
    {
      layout: "portrait",
      slug: "superheated-steam",
      title: "過熱水蒸気",
      latin: "Superheated steam",
      body: "通常のサウナでは味わえない、輻射熱をもつ蒸気\nピリッとしつつ、潤いのある感覚を生み出す\nmadsaunistプロデュースの圧倒的蒸気浴体験",
      photo: { name: "superheated-steam", alt: "過熱水蒸気をつくるスチームジェネレーター（ステンレスのコイルとバルブ）", ratio: 1063 / 1417 },
    },
    {
      layout: "landscape",
      slug: "deep-groundwater",
      title: "飲める地下深層水",
      latin: "Deep groundwater",
      body: "地下100mから汲み上げた飲める地下水\n水風呂に適した適度な硬度があり、体に負荷のない心地よい水風呂が実現",
      photo: { name: "deep-groundwater", alt: "水風呂に注がれる地下水", ratio: 1600 / 1025 },
    },
    {
      layout: "landscape",
      slug: "accoya-deck",
      title: "アコヤ材のウッドデッキ",
      latin: "Accoya wood deck",
      body: "50年間水の中でも腐らない、特殊な加工がされた木材\n温度変化が少ないため、どの季節でも心地よく寝転べる\nささくれ等も発生しないため、滑らかな質感を年中味わえる",
      photo: { name: "accoya-deck", alt: "アコヤ材のウッドデッキとチェア", ratio: 1600 / 1315 },
    },
    {
      layout: "landscape",
      slug: "kneipp",
      title: "クナイプ",
      latin: "Kneipp",
      body: "サウナの中で水浴び\n年中17度が維持される地下水を直接浴びることで、体の表面の温度を下げる\n我慢せずに深部体温を上げることを可能にする\n体験の最後に、氷水を桶で頭から浴びる\n極端な刺激により、非日常を味わい、身体性を取り戻す",
      photo: { name: "kneipp", alt: "砕いた氷", ratio: 1536 / 1024 },
      figure: { value: "17", unit: "℃", caption: "年中変わらない地下水" },
    },
    {
      layout: "landscape",
      slug: "oxygen",
      title: "酸素量の調整",
      latin: "Oxygen balance",
      body: "テントサウナを導入することで、圧倒的な吸気量と排気量を実現\n自然の中で常に大量の酸素を取り込むことで、苦しくないサウナを実現",
      photo: { name: "oxygen", alt: "デッキから見上げる空と木々、宇美町の町並み", ratio: 1418 / 857 },
    },
    {
      layout: "landscape",
      slug: "saturated-steam",
      title: "飽和水蒸気",
      latin: "Saturated steam",
      body: "ロウリュウ等で発生する水蒸気\n過熱水蒸気との割合を調整し、体験設計に活かす",
      photo: { name: "saturated-steam", alt: "湯気を上げて泡立つ水面", ratio: 1536 / 1024 },
    },
    {
      layout: "landscape",
      slug: "stone-stacking",
      title: "石積み",
      latin: "Stone stacking",
      body: "工夫の仕方で、ストーブからの熱を効率よく石に伝えることができる\nまた、密度によって蒸発の速度が変化するため、積み方で蒸気の体験を変えることができる",
      photo: { name: "stone-stacking", alt: "ストーブの上に積み上げたサウナストーン", ratio: 1600 / 999 },
    },
    {
      layout: "wide",
      slug: "fire",
      title: "火入れ",
      latin: "Tending the fire",
      body: "熾火の量で、炉の酸素量と温度をコントロール\n季節とお客様のご希望に沿って、必要な本数を柔軟に判断しながら薪を入れていく\n過熱水蒸気を出すための強力な火力を常に維持する技術が必要",
      photo: { name: "fire", alt: "炉の中で赤く光る熾火", ratio: 1600 / 734 },
    },
    {
      layout: "landscape",
      slug: "undisclosed",
      title: "その他、非公開の体験",
      latin: "Undisclosed",
      body: "ここではご紹介しない、非公開の体験もご準備しています\n内容は当日のお楽しみに",
    },
  ] satisfies Omit<KodawariItem, "no">[]
).map((item, i) => ({ ...item, no: i + 1 }));

export const pad = (n: number) => String(n).padStart(2, "0");
