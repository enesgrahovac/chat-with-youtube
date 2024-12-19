/* eslint-disable react/no-unescaped-entities */

import React from "react";
import styles from "./DefaultPrompt.module.css";
import classNames from "classnames";
import Markdown from "react-markdown";
import CodeBlock from "../CodeBlock/CodeBlock";

export interface ChatMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
}

const DefaultPrompt = ({
  content,
  className,
  ...rest
}: ChatMessageProps) => {

  return (
    <div className={classNames(className, styles.container)} {...rest}>
     
        <div className={styles.senderBubble}>
          <Markdown
            className={styles.markdown}
            components={{
              code(props) {
                const { children, className, ...rest } = props;
                const match = /language-(\w+)/.exec(className || "");
                return match ? (
                  <CodeBlock
                    {...rest}
                    value={String(children).replace(/\n$/, "")}
                    language={match[1]}
                  />
                ) : (
                  <code {...rest} className={className}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </Markdown>
        </div>
    </div>
  );
};

export default DefaultPrompt;
