# PDF Inspector

PDF Inspector is a browser-based tool for exploring the internal structure of PDF files.

The application includes a custom PDF parser written in TypeScript and a React interface for inspecting indirect objects, dictionaries, arrays, references, streams, XRef data, and document revisions.

> The project is currently under active development.

## Features

### PDF inspection

* Load PDF files directly from the browser
* Parse indirect PDF objects
* Browse objects from the sidebar
* Search objects by object number, generation, type, and PDF type
* Inspect dictionaries, arrays, names, strings, numbers, booleans, null values, references, and streams
* Follow indirect references between objects
* Navigate previously opened references using breadcrumbs

### Stream inspection

PDF streams can be inspected in both raw and decoded forms.

Raw stream data is displayed using a Hex viewer:

```text
48 65 6c 6c 6f 20 50 44 46  | Hello PDF
```

The Hex viewer provides:

* hexadecimal byte representation
* ASCII representation
* byte selection
* horizontal and vertical scrolling
* virtualized rendering for large streams

Decoded streams can be viewed as:

* Text
* Hex + ASCII

### Stream filters

The parser currently supports:

* `FlateDecode`
* `ASCIIHexDecode`
* `ASCII85Decode`

Flate streams also support PDF predictor processing, including TIFF and PNG predictors.

Unsupported filters produce a decoding error instead of silently returning incorrect data.

### PDF parser

The custom reader includes support for:

* PDF header parsing
* indirect objects
* object references
* dictionaries
* arrays
* literal strings
* hexadecimal strings
* names
* numbers
* booleans
* null values
* streams
* traditional XRef tables
* XRef streams
* compressed objects
* multiple PDF revisions
* object history
* reference resolution
* document metadata
* page tree navigation
* semantic object diffing
* configurable parser limits and diagnostics

## Tech stack

* React
* TypeScript
* Vite
* Vitest
* Playwright
* Storybook
* pako
* Oxlint
* Oxfmt
* pnpm

## Project structure

```text
.
├── src/
│   ├── components/
│   │   ├── Accordion/
│   │   ├── BreadCrumbs/
│   │   ├── Button/
│   │   ├── DropeZone/
│   │   ├── HexView/
│   │   ├── Loader/
│   │   ├── Modal/
│   │   ├── ObjectItem/
│   │   ├── PdfValue/
│   │   ├── Stack/
│   │   ├── Stream/
│   │   ├── Switch/
│   │   ├── Tabs/
│   │   ├── Togglebutton/
│   │   └── Tree/
│   │
│   ├── reader/
│   │   ├── __tests__/
│   │   ├── xref/
│   │   ├── buffer.ts
│   │   ├── diff.ts
│   │   ├── document.ts
│   │   ├── encoding.ts
│   │   ├── history.ts
│   │   ├── history-api.ts
│   │   ├── objects.ts
│   │   ├── parser.ts
│   │   ├── stream.ts
│   │   ├── tokenizer.ts
│   │   └── types.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── style/
├── .storybook/
├── package.json
└── vite.config.ts
```

## Getting started

### Requirements

Install:

* Node.js
* pnpm

### Install dependencies

```bash
pnpm install
```

### Start development server

```bash
pnpm dev
```

Vite will start the local development server.

## Build

Create a production build:

```bash
pnpm build
```

Preview the production build locally:

```bash
pnpm preview
```

## Code quality

Run Oxlint:

```bash
pnpm lint
```

Automatically fix supported lint problems:

```bash
pnpm lint:fix
```

Format the project:

```bash
pnpm fmt
```

Check formatting without modifying files:

```bash
pnpm fmt:check
```

## Storybook

Start Storybook:

```bash
pnpm storybook
```

Build the static Storybook:

```bash
pnpm build-storybook
```

Storybook browser testing is configured with Vitest and Playwright using Chromium.

## Tests

Reader tests are located in:

```text
src/reader/__tests__/
```

They currently cover areas including:

* buffer operations
* tokenization
* PDF object parsing
* XRef tables
* XRef streams
* document history
* semantic diffing
* parser regressions

Vitest is used as the test runner, with Playwright available for browser-based component tests.

A dedicated project-level `test` script should be added to `package.json` before documenting `pnpm test` as the standard test command.

## Reader API

The PDF reader can also be used directly from TypeScript.

Basic parsing:

```ts
import { parse } from "./reader";

const bytes = new Uint8Array(await file.arrayBuffer());

const document = parse(bytes);

console.log(document.version);
console.log(document.objects);
console.log(document.sections);
```

Retrieve an object:

```ts
import {
  getObject,
  parse,
} from "./reader";

const document = parse(bytes);

const object = getObject(
  document,
  10,
  0,
);
```

Resolve a reference:

```ts
import {
  parse,
  resolveReference,
} from "./reader";

const document = parse(bytes);

const result = resolveReference(
  document,
  {
    type: "reference",
    objectNumber: 10,
    generation: 0,
  },
);
```

Decode a stream:

```ts
import {
  decodeStream,
  parse,
} from "./reader";

const document = parse(bytes);

const object =
  document.objects.get("10 0");

if (object?.value.type === "stream") {
  const decoded =
    decodeStream(object.value);

  console.log(decoded);
}
```

## Parser limits

The parser uses configurable limits to prevent malformed or unusually large PDF structures from consuming unlimited resources.

Limits include restrictions for areas such as:

* input file size
* stream size
* decoded stream size
* object parsing
* document history
* XRef processing

Custom limits can be passed to `parse()` when necessary.

```ts
const document = parse(bytes, {
  limits: {
    maxFileBytes:
      100 * 1024 * 1024,
  },
});
```

## Current status

PDF Inspector is intended primarily as a debugging, exploration, and learning tool for PDF internals.

The parser does not currently aim to support every feature defined by the PDF specification. Unsupported structures or stream filters should be handled explicitly rather than producing silently incorrect output.

## Development goals

Current areas of development include:

* improving PDF compatibility
* expanding stream filter support
* improving Hex and stream inspection
* strengthening parser regression tests
* improving object navigation
* improving large-document performance
* improving layout stability for large PDF objects
