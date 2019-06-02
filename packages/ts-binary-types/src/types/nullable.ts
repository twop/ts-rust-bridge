import { BinType, Static, bindesc, createBinType, TypeTag } from "../core";
import { write_u8, read_u8 } from "ts-binary";

export interface Nullable<T extends BinType<string>>
  extends BinType<TypeTag.Nullable, Static<T> | null, { type: T }> {}

export const Nullable = <T extends BinType<string>>(type: T) => {
  const { read, write } = type[bindesc];

  return createBinType<Nullable<T>>(
    sink => (read_u8(sink) === 1 ? read(sink) : null),
    (sink, val) =>
      val === null ? write_u8(sink, 0) : write(write_u8(sink, 1), val),
    TypeTag.Nullable,
    { type },
    {}
  );
};
