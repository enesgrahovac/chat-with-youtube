import React from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { sunburst } from "react-syntax-highlighter/dist/cjs/styles/hljs";

const CodeBlock = ({
  value,
  language = "",
}: {
  value: string;
  language?: string;
}) => {
  return (
    <SyntaxHighlighter showLineNumbers language={language} style={sunburst}>
      {value}
    </SyntaxHighlighter>
  );
};

export default CodeBlock;
