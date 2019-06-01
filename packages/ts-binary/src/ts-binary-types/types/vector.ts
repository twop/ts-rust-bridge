import { BinType, Static, bindesc, createBinType, TypeTag } from '../core';
import { read_seq, write_seq } from '../..';

export interface Vec<T extends BinType<string>>
  extends BinType<TypeTag.Vec, Static<T>[], { type: T }> {}

export const Vec = <T extends BinType<string>>(type: T) => {
  const { read, write } = type[bindesc];
  return createBinType<Vec<T>>(
    read_seq(read),
    write_seq(write),
    TypeTag.Vec,
    { type },
    {}
  );
};
