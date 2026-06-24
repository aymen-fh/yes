export const serializeDoc = (doc, options = {}) => {
  if (!doc) return null;

  const { exclude = [] } = options;
  const objectValue = doc.toObject ? doc.toObject() : { ...doc };
  const { _id, __v, ...rest } = objectValue;

  for (const key of exclude) {
    delete rest[key];
  }

  return {
    id: _id?.toString?.() ?? _id,
    ...rest,
  };
};

export const serializeDocs = (docs, options = {}) => docs.map((doc) => serializeDoc(doc, options));

export const createReadableCode = (prefix) => {
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `${prefix}-${random}`;
};

export const COUPON_CARD_SERIAL_LENGTH = 14;

export const createNumericCode = (length = COUPON_CARD_SERIAL_LENGTH) => {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

export const toNumericSerial = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
};

export const isValidCouponCardSerial = (value) =>
  new RegExp(`^\\d{${COUPON_CARD_SERIAL_LENGTH}}$`).test(String(value || ""));
