import { BinType, Static, bindesc, createBinType, TypeTag } from "../core";
import { opt_reader, opt_writer } from "ts-binary";

export interface Optional<T extends BinType<string>>
  extends BinType<TypeTag.Optional, Static<T> | undefined, { type: T }> {}

export const Optional = <T extends BinType<string>>(type: T) => {
  const { read, write } = type[bindesc];
  return createBinType<Optional<T>>(
    opt_reader(read),
    opt_writer(write),
    TypeTag.Optional,
    { type },
    {}
  );
};
