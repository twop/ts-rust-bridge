import { Union, of } from 'ts-union';

export type D = number;
export module D {
  export type StringEnum = {
    name: string;
    variants: [string, string][];
  };

  export type Field = {
    name: string;
    type: string;
    optional?: true;
  };

  export type Interface = {
    name: string;
    fields: Field[];
  };

  export type Union = {
    name: string;
    tagField: string;
    valueField: string;
    variants: { tag: string; valueType?: string }[];
  };

  export type ArrowFunc = {
    name: string;
    params: Field[];
    returnType?: string;
    wrappedInBraces?: true;
    body: string;
  };

  export type Alias = {
    name: string;
    toType: string;
  };

  export type ConstVar = {
    name: string;
    type?: string;
    expression: string;
  };
}

export const TsFileBlock = Union({
  StringEnum: of<D.StringEnum>(),
  Interface: of<D.Interface>(),
  Union: of<D.Union>(),
  ArrowFunc: of<D.ArrowFunc>(),
  Alias: of<D.Alias>(),
  ConstVar: of<D.ConstVar>()
});

export type TsFileBlockT = typeof TsFileBlock.T;
