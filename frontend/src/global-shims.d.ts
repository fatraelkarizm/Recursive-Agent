declare const process: {
  env: Record<string, string | undefined>;
};

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}
