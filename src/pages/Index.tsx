import { Header } from "@/components/Header";
import ReservationForm from "@/components/ReservationForm";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <div id="reservation-section" className="mt-[-2vh] md:mt-[-10vh] text-center">
        <ReservationForm />
      </div>
      
      <section className="max-w-4xl mx-auto px-4 py-20">
        <div className="mt-20 glass-card p-8">
          <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
            アクセス
          </h2>
          
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div>
                <p className="text-sauna-stone/90">
                  〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4
                </p>
                <a 
                  href="https://maps.google.com/maps?q=8Q5GHG7V%2BJ5" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sauna-copper hover:underline mt-2 inline-block"
                >
                  Google Mapsで見る
                </a>
              </div>
              
              <div className="pt-6">
                <h3 className="font-semibold mb-2">お車でお越しの場合</h3>
                <p className="text-sauna-stone/90">福岡空港から車で30分（交通状況によってはそれ以上かかることがありますので、ご注意ください）</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">電話でお越しの場合</h3>
                <p className="text-sauna-stone/90">
                  JR香椎線 宇美駅からバスで20分
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;