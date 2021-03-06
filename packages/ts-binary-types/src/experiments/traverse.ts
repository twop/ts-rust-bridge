import { Optional } from "../types/optional";
import { Nullable } from "../types/nullable";
import { Str } from "../types/str";
import { Struct } from "../types/struct";
import { Tuple } from "../types/tuple";
import { Union } from "../types/union";
import { Vec } from "../types/vector";
import { bindesc, TypeTag, BinType } from "../core";
import { Bool } from "../types/bool";
import { F32, I32, U32, U16, U8, F64 } from "../types/numbers";
import { Enum } from "../types/enum";

export type BuiltInType =
  | Bool
  | Str
  | F32
  | F64
  | I32
  | U32
  | U16
  | U8
  | Enum<any>
  | Optional<any>
  | Nullable<any>
  | Vec<any>
  | Tuple<any>
  | Struct<any>
  | Union<any>;

module AST {
  export type BinNode =
    | TypeTag.Bool
    | TypeTag.Str
    | TypeTag.F32
    | TypeTag.F64
    | TypeTag.I32
    | TypeTag.U32
    | TypeTag.U16
    | TypeTag.U8
    | { tag: TypeTag.Optional | TypeTag.Vec | TypeTag.Nullable; type: BinNode }
    | { tag: TypeTag.Struct; fields: ([string, BinNode])[] }
    | { tag: TypeTag.Union; variants: { [key: string]: BinNode | null } }
    | { tag: TypeTag.Enum; variants: string[] }
    | { tag: TypeTag.Tuple; types: [BinNode, BinNode, ...BinNode[]] };
}

export const bintypeToBinAst = (bintype: BuiltInType): AST.BinNode => {
  const data = bintype[bindesc];
  switch (data.tag) {
    case TypeTag.Bool:
    case TypeTag.Str:
    case TypeTag.F32:
    case TypeTag.F64:
    case TypeTag.I32:
    case TypeTag.U8:
    case TypeTag.U16:
    case TypeTag.U32:
      return data.tag;

    case TypeTag.Optional:
    case TypeTag.Nullable:
    case TypeTag.Vec:
      return { tag: data.tag, type: bintypeToBinAst(data.type) };

    case TypeTag.Tuple:
      return {
        tag: TypeTag.Tuple,
        types: data.components.map(bintypeToBinAst)
      };

    case TypeTag.Enum:
      return {
        tag: TypeTag.Enum,
        variants: data.variants
      };

    case TypeTag.Struct: {
      const fields = data.fields as {
        [_: string]: BinType<any, any, any>;
      };

      return {
        tag: TypeTag.Struct,
        fields: Object.entries(fields).map(
          ([fieldName, bintype]): [string, AST.BinNode] => [
            fieldName,
            bintypeToBinAst(bintype)
          ]
        )
      };
    }
    case TypeTag.Union: {
      const variants = data.variants as {
        [_: string]: BinType<any, any, any> | null;
      };
      return {
        tag: TypeTag.Union,
        variants: Object.entries(variants).reduce(
          (v, [variantName, bintype]) => {
            v[variantName] = bintype === null ? null : bintypeToBinAst(bintype);
            return v;
          },
          {} as { [_: string]: AST.BinNode | null }
        )
      };
    }
  }

  const shouldHaveChecked: never = data;
  shouldHaveChecked;

  throw new Error("uknown type " + (data as any).tag);
};

export const binAst2bintype = (node: AST.BinNode): BuiltInType => {
  if (node === TypeTag.Bool) return Bool;
  if (node === TypeTag.Str) return Str;
  if (node === TypeTag.F32) return F32;
  if (node === TypeTag.F64) return F64;
  if (node === TypeTag.I32) return I32;
  if (node === TypeTag.U32) return U32;
  if (node === TypeTag.U16) return U16;
  if (node === TypeTag.U8) return U8;

  switch (node.tag) {
    case TypeTag.Optional:
      return Optional(binAst2bintype(node.type));
    case TypeTag.Nullable:
      return Nullable(binAst2bintype(node.type));
    case TypeTag.Vec:
      return Vec(binAst2bintype(node.type));

    case TypeTag.Tuple:
      return Tuple(
        ...(node.types.map(binAst2bintype) as [
          BuiltInType,
          BuiltInType,
          ...BuiltInType[]
        ])
      );

    case TypeTag.Enum:
      return Enum(...node.variants);

    case TypeTag.Struct: {
      const { fields } = node;

      const fieldsObj = fields.reduce(
        (obj, [fieldName, binNode]) => {
          obj[fieldName] = binAst2bintype(binNode);
          return obj;
        },
        {} as { [_: string]: BuiltInType }
      );

      return Struct(fieldsObj);
    }

    case TypeTag.Union: {
      const { variants } = node;

      const variantsObj = Object.keys(variants).reduce(
        (obj, variantName) => {
          const binNode = variants[variantName];
          obj[variantName] = binNode === null ? null : binAst2bintype(binNode);
          return obj;
        },
        {} as { [_: string]: BuiltInType | null }
      );

      return Union(variantsObj);
    }
  }

  throw new Error("uknown type " + JSON.stringify(node));
};
