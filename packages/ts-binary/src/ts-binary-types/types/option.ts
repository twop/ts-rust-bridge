import { BinType, Static, bindesc, createBinType, TypeTag } from '../core';
import { read_opt, write_opt } from '../..';

export interface Option<T extends BinType<string>>
  extends BinType<TypeTag.Option, Static<T> | undefined, { type: T }> {}

export const Option = <T extends BinType<string>>(type: T) => {
  const { read, write } = type[bindesc];
  return createBinType<Option<T>>(
    read_opt(read),
    write_opt(write),
    TypeTag.Option,
    { type },
    {}
  );
};
