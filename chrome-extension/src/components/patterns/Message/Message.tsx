/* eslint-disable react/no-unescaped-entities */

import React from "react";
import styles from "./Message.module.css";
import Divider from "../Divider/Divider";
import classNames from "classnames";
import Markdown from "react-markdown";
import CodeBlock from "../CodeBlock/CodeBlock";

export interface ChatMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  isHuman: boolean;
  content: string;
  timestamp: Date;
  referenceURL?: string;
  referenceGoal?: string;
  siteTitle?: string;
  id?: string;
}

const Message = ({
  isHuman = true,
  content,
  timestamp,
  referenceURL,
  referenceGoal,
  siteTitle = "",
  className,
  ...rest
}: ChatMessageProps) => {
  const domainRegex: RegExp =
    /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/;
  const match: RegExpExecArray | null = domainRegex.exec(referenceURL ? referenceURL : "");
  const rootDomain: string | null = match ? match[1] : null;

  const blockText = rootDomain ? `Redirected from ${rootDomain}` : "Redirected";

  return (
    <div className={classNames(className, styles.container)} {...rest}>
      {referenceURL && (
        <div className={styles.chatBreak}>
          <Divider muted className={styles.divider} />
          <div className={styles.chatBreakContent}>
            <p>
              {blockText}: {siteTitle ? `'${siteTitle}'` : ""} · Added to your{" "}
            </p>
          </div>
          <Divider muted className={styles.divider} />
        </div>
      )}
      <div className={styles.contentWrapper}>
        <div className={styles.headerContainer}>
          <div
            className={isHuman ? styles.senderAvatar : styles.receiverAvatar}
          />
          <h3 className={styles.header}>{isHuman ? <>You</> : <>YouTube Copilot</>}</h3>
          {!isHuman && (
            <div className={styles.modelContainer}>
              <p className={styles.modelInfo}>GPT 4o</p>
              {/* <p className={styles.onHoverModel}>
                Want to switch between models?{" "}
                
                .
              </p> */}
            </div>
          )}
        </div>
        <div className={isHuman ? styles.senderBubble : styles.receiverBubble}>
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
    </div>
  );
};

export default Message;
