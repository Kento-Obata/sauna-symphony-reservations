export const getSurcharge = (temp: number): number => {
  if (temp <= 7) return 5000;
  return 0;
};

export const getTotalPrice = (waterTemperature: number): number => {
  const basePrice = 40000;
  const surcharge = getSurcharge(waterTemperature);
  return basePrice + surcharge;
};

export const formatPrice = (price: number): string => {
  return `¥${price.toLocaleString()}`;
};