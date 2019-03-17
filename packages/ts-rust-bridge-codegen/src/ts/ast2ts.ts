import { TsFileBlock, TsFileBlockT, D } from './ast';
import { FileBlock } from '../schema';
import { Module, isModule } from './schema2ast';

export const ast2ts = (tsBlocks: (TsFileBlockT | Module)[]): FileBlock[] =>
  tsBlocks.reduce(
    (blocks, tsBlock) =>
      isModule(tsBlock)
        ? blocks
            .concat(startModule(tsBlock.name))
            .concat(ast2ts(tsBlock.blocks))
            .concat(endModule())
        : blocks.concat(
            TsFileBlock.match(tsBlock, {
              StringEnum: genStringEnum,
              Interface: genInterface,
              ArrowFunc: genArrowFunc,
              Union: genUnion,
              Alias: genAlias,
              ConstVar: genConstVariable
            })
          ),
    [] as FileBlock[]
  );

const startModule = (name: string): FileBlock => `export module ${name} {
`;

const endModule = (): FileBlock => `
}`;

const genStringEnum = ({ name, variants }: D.StringEnum): FileBlock =>
  `export enum ${name} {
${variants.map(v => `  ${v[0]} = "${v[1]}"`).join(',\n')}
}
`;

const genInterface = ({
  name: interfaceName,
  fields
}: D.Interface): FileBlock =>
  `export interface ${interfaceName} {
    ${fields
      .map(
        ({ name, type, optional }) => `  ${name}${optional ? '?' : ''}: ${type}`
      )
      .join(';\n')}
    }
    `;

const genArrowFunc = ({
  name,
  params,
  returnType,
  wrappedInBraces,
  body
}: D.ArrowFunc): FileBlock =>
  `export const ${name} = (${params
    .map(({ name: n, type }) => `${n}: ${type}`)
    .join(', ')})${returnType ? `: ${returnType}` : ''} => ${
    wrappedInBraces
      ? `{
  ${body};      
  }`
      : `${body};`
  }`;

const genUnion = ({
  name: unionName,
  tagField,
  valueField,
  variants
}: D.Union): FileBlock =>
  `export type ${unionName} = 
${variants
  .map(
    ({ tag, valueType }) =>
      `  | { ${tagField}: "${tag}"${
        valueType ? `, ${valueField}: ${valueType}` : ''
      }}`
  )
  .join('\n')}
`;

const genAlias = ({ name, toType }: D.Alias): FileBlock =>
  `export type ${name} = ${toType}`;

const genConstVariable = ({ name, type, expression }: D.ConstVar): FileBlock =>
  `export const ${name}${type ? `: ${type}` : ''} = ${expression};`;
