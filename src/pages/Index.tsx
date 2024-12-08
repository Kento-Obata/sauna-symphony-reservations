import Header from "@/components/Header";
import ReservationForm from "@/components/ReservationForm";
import Map from "@/components/Map";

const Index = () => {
  return (
    <div className="min-h-screen pb-20">
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-20">
        <ReservationForm />
        
        <div className="mt-20 glass-card p-8">
          <h2 className="text-3xl font-bold mb-8 text-center text-gradient">
            アクセス
          </h2>
          
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sauna-stone/90">
                〒811-2127 福岡県糟屋郡宇美町障子岳6-8-4
              </p>
              <p className="text-sauna-stone/90 mt-2">
                Plus Code: 8Q5GHG7V+J5
              </p>
            </div>
            
            <Map />
            
            <div className="space-y-4 text-center">
              <div>
                <h3 className="font-semibold mb-2">お車でお越しの場合</h3>
                <p className="text-sauna-stone/90">福岡市内から約30分</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">電車でお越しの場合</h3>
                <p className="text-sauna-stone/90">
                  JR香椎線 宇美駅から徒歩15分
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