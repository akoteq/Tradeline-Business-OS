/* eslint-disable @typescript-eslint/no-explicit-any */
export const jsonTransform = (_doc: any, ret: any): void => {
  ret.id = String(ret._id);
  delete ret._id;
};
