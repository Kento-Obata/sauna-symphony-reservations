const Header = () => (
  <header className="relative h-screen flex items-center justify-center overflow-hidden">
    <div 
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url('/sauna-bg.jpg')`,
      }}
    />
    <div className="absolute inset-0 bg-gradient-to-b from-sauna-charcoal/90 to-sauna-charcoal/70 backdrop-blur-sm z-0" />
    <div className="relative z-10 text-center px-4 animate-fade-up">
      <h1 className="text-8xl font-bold mb-6 text-gradient">U</h1>
      <p className="text-xl mb-8 text-sauna-stone">
        福岡、宇美町。五感で味わう究極のサウナ
      </p>
      <p className="text-lg text-sauna-stone/80 max-w-2xl mx-auto">
        5℃から17℃まで、お好きな水風呂の温度を教えてください。
        あとは我々にお任せを。
      </p>
    </div>
  </header>
);

export default Header;