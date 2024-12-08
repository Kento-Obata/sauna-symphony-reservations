const Map = () => {
  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3325.576204669542!2d130.53916610000002!3d33.5671799!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzPCsDM0JzAxLjkiTiAxMzDCsDMyJzIxLjAiRQ!5e0!3m2!1sja!2sjp!4v1710910000000!5m2!1sja!2sjp&query=8Q5GHG7V%2BJ5"
        width="100%"
        height="300"
        style={{ border: 0 }}
        loading="lazy"
        fetchpriority="low"
        referrerPolicy="no-referrer-when-downgrade"
        className="rounded-lg shadow-lg"
      ></iframe>
    </div>
  );
};

export default Map;