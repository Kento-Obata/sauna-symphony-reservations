
import { Header } from "@/components/Header";
import ReservationForm from "@/components/ReservationForm";
import { useEffect, useState } from "react";
import { fetchPriceSettings } from "@/utils/priceCalculations";
import { PriceSetting } from "@/types/price";

const Index = () => {
  const [priceData, setPriceData] = useState<{
    people: number;
    perPerson: number;
    total: number;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPriceData = async () => {
      try {
        setIsLoading(true);
        const priceSettings = await fetchPriceSettings();
        
        if (priceSettings.length > 0) {
          // データベースから取得した料金設定を使用
          const formattedData = priceSettings.map(setting => ({
            people: setting.guest_count,
            perPerson: setting.price_per_person,
            total: setting.guest_count * setting.price_per_person
          }));
          setPriceData(formattedData);
        } else {
          // 料金設定がない場合はデフォルト値を使用
          setPriceData([{
            people: 2,
            perPerson: 7500,
            total: 15000
          }, {
            people: 3,
            perPerson: 7000,
            total: 21000
          }, {
            people: 4,
            perPerson: 7000,
            total: 28000
          }, {
            people: 5,
            perPerson: 6000,
            total: 30000
          }, {
            people: 6,
            perPerson: 6000,
            total: 36000
          }]);
        }
      } catch (error) {
        console.error("Error loading price data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPriceData();
  }, []);

  return <div className="min-h-screen flex flex-col bg-sauna-base">
      <Header />
      <div className="h-[30vh] relative bg-sauna-base">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-4xl w-full px-4">
          <div className="glass-card p-2 space-y-2 w-full hover-lift text-center">
            <div className="text-lg font-mplus font-extralight tracking-[0.2em] text-black">
              1日3組限定
            </div>
            <div className="text-sm font-mplus font-extralight tracking-[0.15em] text-black/80">
              詳細非公開体験型サウナ
            </div>
            <p className="text-xs text-black/90 mt-2 font-mplus font-extralight">
              pre-open<br />
              2025.03.01<br />
              grand-open<br />
              2025.04.01
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 text-center">
        <ReservationForm />
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        <div className="glass-card p-8 mb-8">
          <div className="text-3xl font-mplus font-thin mb-8 text-center text-gradient">
            Price
          </div>
          <div className="mb-8 text-center">
            <p className="text-base font-mplus text-black bg-sauna-base shadow-sm border border-sauna-stone/20 rounded-lg p-6 inline-block">プレオープン期間（3月）のみ 
オリジナルビールのお土産付きで1名様5000円でご利用いただけます</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sauna-stone/10">
                  <th className="py-4 px-6 text-left text-sm font-mplus font-extralight">人数</th>
                  <th className="py-4 px-6 text-right text-sm font-mplus font-extralight">お一人様</th>
                  <th className="py-4 px-6 text-right text-sm font-mplus font-extralight">合計金額</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="py-4 px-6 text-center">
                      <div className="flex justify-center">
                        <div className="animate-pulse h-4 w-24 bg-sauna-stone/10 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  priceData.map(({
                    people,
                    perPerson,
                    total
                  }) => (
                    <tr key={people} className="border-b border-sauna-stone/10">
                      <td className="py-4 px-6 text-left">{people}</td>
                      <td className="py-4 px-6 text-right">¥{perPerson.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right">¥{total.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-black/90 space-y-2">
            <p className="bg-sauna-base p-4 rounded-lg border border-sauna-stone/20">
              【option】<br />
              水温10℃ ~ 14℃ +3000円<br />
              水温5℃ ~ 10℃ +5000円<br />
              ※ 水風呂温度は9月以降ご指定いただけますが、プレ期間でもinstagramのDMにて希望の温度をお伝えいただければ、可能な限り対応させていただきます。
            </p>
            <p>※ 1名様でのご利用をご希望の際は、2名様料金でご利用いただけます。</p>
          </div>
        </div>
      </div>
      
      <section className="max-w-4xl mx-auto px-4 py-8 bg-sauna-base">
        <div className="mt-20 glass-card p-8">
          <div className="text-3xl font-mplus font-extralight mb-8 text-center text-gradient">
            Access
          </div>
          
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div>
                <p className="text-black">
                  〒811-2127<br />
                  福岡県糟屋郡宇美町障子岳6-8-4
                </p>
                <a href="https://www.google.com/maps?q=8Q5GHG7V%2BJ5" target="_blank" rel="noopener noreferrer" className="text-black hover:underline mt-2 inline-block">
                  Google Mapsで見る
                </a>
              </div>
              
              <div className="pt-6">
                <div className="font-mplus font-extralight mb-2">お車でお越しの場合</div>
                <p className="text-black">福岡空港から車で30分（交通状況によってはそれ以上かかることがありますので、ご注意ください）</p>
              </div>
              
              <div>
                <div className="font-mplus font-extralight mb-2">電車でお越しの場合</div>
                <p className="text-black">
                  JR香椎線 宇美駅からバスで20分
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto py-8 px-4 border-t border-sauna-stone/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-sauna-stone/70">
            © 2024 株式会社sync All rights reserved.
          </p>
        </div>
      </footer>
    </div>;
};
export default Index;
