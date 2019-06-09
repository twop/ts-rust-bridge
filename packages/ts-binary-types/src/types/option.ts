import { BinType, Static, bindesc, createBinType, TypeTag } from "../core";
import { opt_reader, opt_writer } from "ts-binary";

export interface Option<T extends BinType<string>>
  extends BinType<TypeTag.Option, Static<T> | undefined, { type: T }> {}

export const Option = <T extends BinType<string>>(type: T) => {
  const { read, write } = type[bindesc];
  return createBinType<Option<T>>(
    opt_reader(read),
    opt_writer(write),
    TypeTag.Option,
    { type },
    {}
  );
};
