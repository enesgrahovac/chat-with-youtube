import React from "react";
import styles from "./InputFooter.module.css";
import { ArrowUp } from "lucide-react";
import classNames from "classnames";
import Button from "../patterns/Button/Button";

interface InputFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    onMessageSend: (message: string) => void;
    isSendingDisabled: boolean; // This prop indicates if sending is disabled
}

const InputFooter = ({
    onMessageSend,
    isSendingDisabled,
    className,
    ...rest
}: InputFooterProps) => {
    const [text, setText] = React.useState("");
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);


    // Inside your component
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        resizeTextarea(e.target);
    };

    // When sending a message
    const handleSendMessage = () => {
        if (text.trim() && !isSendingDisabled) {
            onMessageSend(text);
            setText("");
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = '52px'; // Reset height to auto before resizing to ensure correct calculation
                // resizeTextarea(textarea);
            }
        }
    };

    const maxLines = 9;
    const lineHeight = 24; // Assuming 24px line height as given
    const maxHeight = lineHeight * maxLines;

    function resizeTextarea(textarea: HTMLTextAreaElement) {
        // Measure the initial single line height (if not already known)
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseInt(computedStyle.lineHeight, 10) || parseInt(computedStyle.fontSize, 10) * 1.2;
        const verticalPadding = parseInt(computedStyle.paddingTop, 10) + parseInt(computedStyle.paddingBottom, 10);
        const border = parseInt(computedStyle.borderTopWidth, 10) + parseInt(computedStyle.borderBottomWidth, 10);
        const initialSingleLineHeight = lineHeight + verticalPadding + border;
        
        // Set the initial height to accommodate exactly one line of text
        textarea.style.height = `${initialSingleLineHeight}px`;
        textarea.style.overflowY = 'hidden'; // Ensure overflow is initially hidden

        // Adjust the textarea height based on content
        const scrollHeight = textarea.scrollHeight;
        if (scrollHeight > initialSingleLineHeight) {
            if (scrollHeight >= maxHeight) {
                textarea.style.height = `${maxHeight}px`;
                textarea.style.overflowY = 'auto'; // Allow scrolling when content exceeds maxHeight
            } else {
                textarea.style.height = `${scrollHeight}px`; // Expand to fit content
            }
        }
    }
    
    // Correct the event handler type to match a <textarea>
    const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !isSendingDisabled) {
            e.preventDefault(); // Prevent the default action to avoid submitting the form or inserting a new line
            handleSendMessage();
        } else if (e.key === "Enter" && e.shiftKey) {
        }
    };

    return (
        <div className={classNames(className, styles.container)} {...rest}>
            <div className={styles.inputContainer}>
                <textarea
                    ref={textareaRef}
                    placeholder="Ask about your video..."
                    className={`${styles.input} input`}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                />




                <Button
                    variant="primary"
                    icon={<ArrowUp />}
                    className={styles.sendButton}
                    onClick={handleSendMessage}
                    disabled={!text.trim() || isSendingDisabled} // The button is disabled if there's no text or if sending is disabled
                />
            </div>
        </div>
    );
};

export default InputFooter;
