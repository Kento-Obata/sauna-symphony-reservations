import { Header } from "@/components/Header";
import ReservationForm from "@/components/ReservationForm";
import Map from "@/components/Map";

const Index = () => {
  return (
    <div className="min-h-screen bg-pattern">
      <Header />
      
      <div id="reservation-section" className="mt-4 md:mt-[-10vh] text-center px-4">
        <ReservationForm />
      </div>
      
      <section className="max-w-4xl mx-auto px-4 py-20">
        <div className="mt-20 glass-card p-8 md:p-12">
          <h2 className="text-3xl font-light mb-12 text-center text-gradient">
            Access
          </h2>
          
          <div className="space-y-8">
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <p className="text-white/80 tracking-wide">
                  〒811-2127<br />福岡県糟屋郡宇美町障子岳6-8-4
                </p>
                <a 
                  href="https://maps.google.com/maps?q=8Q5GHG7V%2BJ5" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sauna-copper hover:text-sauna-copper/80 transition-colors mt-2 inline-block tracking-wide"
                >
                  Google Mapsで見る
                </a>
              </div>
              
              <Map />
              
              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div className="glass-card p-6">
                  <h3 className="font-medium mb-3 text-white/90">お車でお越しの場合</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    福岡空港から車で30分<br />
                    （交通状況によってはそれ以上かかることがありますので、ご注意ください）
                  </p>
                </div>
                
                <div className="glass-card p-6">
                  <h3 className="font-medium mb-3 text-white/90">電車でお越しの場合</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    JR香椎線 宇美駅からバスで20分
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;