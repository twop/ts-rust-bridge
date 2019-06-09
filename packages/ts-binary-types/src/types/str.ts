import { read_str, write_str } from "ts-binary";
import { createBinType, BinType, TypeTag } from "../core";

export interface Str extends BinType<TypeTag.Str, string> {}
export const Str = createBinType<Str>(read_str, write_str, TypeTag.Str, {}, {});
