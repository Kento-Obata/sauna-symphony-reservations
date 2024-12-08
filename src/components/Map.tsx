const Map = () => {
  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <iframe
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3325.5762046695424!2d130.5391661!3d33.5671799!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3541866d8df8d4c5%3A0x7f1f7b07961f13e8!2z44CSODExLTIxMjcg56aP5bKh55yM57OJ5bGL6YOh5a6X576O55S65pWF5a2Q5bKz77yW5LiB55uu77yY4oiS77yU!5e0!3m2!1sja!2sjp!4v1710910000000!5m2!1sja!2sjp"
        width="100%"
        height="300"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="rounded-lg shadow-lg"
      ></iframe>
    </div>
  );
};

export default Map;