import { Option } from '../types/option';
import { Str } from '../types/str';
import { Struct } from '../types/struct';
import { Tuple2, Tuple3, Tuple } from '../types/tuple';
import { Union } from '../types/union';
import { Vec } from '../types/vector';
import { bindesc, TypeTag, BinType } from '../core';
import { Bool } from '../types/bool';
import { F32, I32, U32, U16, U8 } from '../types/numbers';
import { Enum } from '../types/enum';

export type BuiltInTypes =
  | Bool
  | Str
  | F32
  | I32
  | U32
  | U16
  | U8
  | Enum<any>
  | Option<any>
  | Vec<any>
  | Tuple2<any, any>
  | Tuple3<any, any, any>
  | Struct<any>
  | Union<any>;

module AST {
  export type BinNode =
    | TypeTag.Bool
    | TypeTag.Str
    | TypeTag.F32
    | TypeTag.I32
    | TypeTag.U32
    | TypeTag.U16
    | TypeTag.U8
    | { tag: TypeTag.Option | TypeTag.Vec; type: BinNode }
    | { tag: TypeTag.Struct; fields: ([string, BinNode])[] }
    | { tag: TypeTag.Union; variants: { [key: string]: BinNode | null } }
    | { tag: TypeTag.Enum; variants: string[] }
    | { tag: TypeTag.Tuple; types: BinNode[] };
}

export const bintypeToBinAst = (bintype: BuiltInTypes): AST.BinNode => {
  const data = bintype[bindesc];
  switch (data.tag) {
    case TypeTag.Bool:
      return TypeTag.Bool;

    case TypeTag.Str:
      return TypeTag.Str;

    case TypeTag.F32:
      return TypeTag.F32;

    case TypeTag.I32:
      return TypeTag.I32;

    case TypeTag.U32:
      return TypeTag.U32;

    case TypeTag.U16:
      return TypeTag.U16;

    case TypeTag.U8:
      return TypeTag.U8;

    case TypeTag.Option:
    case TypeTag.Vec:
      return { tag: TypeTag.Option, type: bintypeToBinAst(data.type) };

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

  throw new Error('uknown type ' + (data as any).tag);
};

export const binAst2bintype = (node: AST.BinNode): BuiltInTypes => {
  if (node === TypeTag.Bool) return Bool;
  if (node === TypeTag.Str) return Str;
  if (node === TypeTag.F32) return F32;
  if (node === TypeTag.I32) return I32;
  if (node === TypeTag.U32) return U32;
  if (node === TypeTag.U16) return U16;
  if (node === TypeTag.U8) return U8;

  switch (node.tag) {
    case TypeTag.Option:
      return Option(binAst2bintype(node.type));
    case TypeTag.Vec:
      return Vec(binAst2bintype(node.type));

    case TypeTag.Tuple: {
      const { types } = node;
      const [A, B, C] = types.map(binAst2bintype);
      if (types.length === 2) {
        return Tuple(A, B);
      }

      if (types.length === 3) {
        return Tuple(A, B, C);
      }
      throw new Error('wrong number of args for tuple ' + types.length);
    }

    case TypeTag.Enum:
      return Enum(...node.variants);

    case TypeTag.Struct: {
      const { fields } = node;

      const fieldsObj = fields.reduce(
        (obj, [fieldName, binNode]) => {
          obj[fieldName] = binAst2bintype(binNode);
          return obj;
        },
        {} as { [_: string]: BuiltInTypes }
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
        {} as { [_: string]: BuiltInTypes | null }
      );

      return Union(variantsObj);
    }
  }

  throw new Error('uknown type ' + JSON.stringify(node));
};
