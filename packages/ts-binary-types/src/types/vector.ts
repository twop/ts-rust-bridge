import { BinType, Static, bindesc, createBinType, TypeTag } from "../core";
import { seq_reader, seq_writer } from "ts-binary";

export interface Vec<T extends BinType<string>>
  extends BinType<TypeTag.Vec, Static<T>[], { type: T }> {}

export const Vec = <T extends BinType<string>>(type: T) => {
  const { read, write } = type[bindesc];
  return createBinType<Vec<T>>(
    seq_reader(read),
    seq_writer(write),
    TypeTag.Vec,
    { type },
    {}
  );
};
