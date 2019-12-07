import { Union, of } from 'ts-union';

export module Code {
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
    dontExport?: true;
  };

  export type Alias = {
    name: string;
    toType: string;
  };

  export type ConstVar = {
    name: string;
    type?: string;
    dontExport?: true;
    expression: string;
  };

  export type Import = {
    names: string[];
    from: string;
  };
}

export const TsFileBlock = Union({
  StringEnum: of<Code.StringEnum>(),
  Interface: of<Code.Interface>(),
  Union: of<Code.Union>(),
  LineComment: of<string>(),
  ArrowFunc: of<Code.ArrowFunc>(),
  Alias: of<Code.Alias>(),
  ConstVar: of<Code.ConstVar>(),
  Import: of<Code.Import>()
});

export type TsFileBlock = typeof TsFileBlock.T;
