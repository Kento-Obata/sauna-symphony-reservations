import Header from "@/components/Header";
import ReservationForm from "@/components/ReservationForm";

const Index = () => {
  return (
    <div className="min-h-screen pb-20">
      <Header />
      <section className="max-w-4xl mx-auto px-4 py-20">
        <ReservationForm />
      </section>
    </div>
  );
};

export default Index;