import React, { useEffect, useRef, forwardRef, useState } from "react";
import classNames from "classnames";
import Message, { ChatMessageProps } from "../patterns/Message/Message";
import styles from "./ChatArea.module.css";

interface ChatAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    chatHistory: ChatMessageProps[];
    enableSmoothScroll?: boolean;
    autoScrollToBottom?: boolean;
    onLoadMoreMessages?: () => void;
    onInitialScrollComplete?: () => void;
}

const ChatArea = forwardRef<HTMLDivElement, ChatAreaProps>(({
    chatHistory,
    className,
    enableSmoothScroll,
    autoScrollToBottom = true,
    onInitialScrollComplete,
    ...rest
}, ref) => {
    const bottomMessageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScrollToBottom && bottomMessageRef.current) {
            const scrollBehavior: ScrollBehavior = enableSmoothScroll ? "smooth" : "auto";
            bottomMessageRef.current.scrollIntoView({
                behavior: scrollBehavior,
            });

            const delay = enableSmoothScroll ? 2000 : 0;
            setTimeout(() => {
                onInitialScrollComplete?.();
            }, delay);
        }
        else {
            onInitialScrollComplete?.()
        }
    }, [chatHistory, enableSmoothScroll, autoScrollToBottom]);


    return (
        <div ref={ref} className={classNames(className, styles.container)} {...rest}>

            {chatHistory.map((messageItem, index) => (
                <Message key={index} {...messageItem} />
            ))}
            <div
                style={{ float: "left", clear: "both" }}
                ref={bottomMessageRef}
            />
        </div>
    );
});

// Assign a display name to your component
ChatArea.displayName = 'ChatArea';

export default React.memo(ChatArea);
