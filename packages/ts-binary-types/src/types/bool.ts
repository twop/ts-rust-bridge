import { read_bool, write_bool } from "ts-binary";
import { createBinType, BinType, TypeTag } from "../core";

export interface Bool extends BinType<TypeTag.Bool, boolean> {}

export const Bool = createBinType<Bool>(
  read_bool,
  write_bool,
  TypeTag.Bool,
  {},
  {}
);
