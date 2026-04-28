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
