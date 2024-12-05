import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatArea from './components/ChatArea/ChatArea';
import InputFooter from './components/InputFooter/InputFooter';
import './globals.css';
// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ status: "pong" });
        return true;
    }

    if (request.action === "initializeChatPanel") {
        createChatPanel();
        return true;
    }
});

function ChatPanel() {
    // Create initial state
    const initialChatHistory = [
        {
            isHuman: false,
            content: "Hi! I'm your YouTube assistant. Ask me anything about this video and I will answer your questions.",
            timestamp: new Date()
        }
    ];

    const [chatHistory, setChatHistory] = React.useState(initialChatHistory);

    const handleMessageSend = async (message: string) => {
        // Add user message
        const userMessage = {
            isHuman: true,
            content: message,
            timestamp: new Date()
        };
        
        setChatHistory(prev => [...prev, userMessage]);

        // Simulate AI response
        const dummyAiResponse = {
            isHuman: false,
            content: "This is a placeholder AI response. The actual AI integration will be implemented later.",
            timestamp: new Date()
        };

        // Add AI response after a small delay to simulate processing
        setTimeout(() => {
            setChatHistory(prev => [...prev, dummyAiResponse]);
        }, 1000);
    };

    return (
        <div className="chat-extension-root" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            gap: '8px',
            padding: '8px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                height: '20px',
                width: '100%',
                backgroundColor: 'var(--yc-red)',
                color: 'var(--fg-on-accent)',
            }}>Close Panel</div>
            <div style={{ 
                flex: '1 1 auto',
                overflowY: 'auto',
                minHeight: 0, // This is important for Firefox
            }}>
                <ChatArea chatHistory={chatHistory} />
            </div>
            <div style={{ flexShrink: 0 }}>
                <InputFooter onMessageSend={handleMessageSend} isSendingDisabled={false} />
            </div>
        </div>
    );
}

function createChatPanel() {
    const chatPanelWidth = 333;

    // Check if panel already exists
    if (document.getElementById('youtube-chat-panel')) {
        return;
    }

    // Create the chat panel
    const chatPanel = document.createElement('div');
    chatPanel.id = 'youtube-chat-panel';
    chatPanel.className = 'chat-extension-root';
    chatPanel.style.cssText = `
        position: fixed;
        top: 56px;
        right: 0;
        width: ${chatPanelWidth}px;
        height: calc(100vh - 56px);
        background-color: var(--bg-base);
        border-left: 1px solid var(--border-base);
        z-index: 2000;
        box-shadow: var(--box-shadow);
    `;

    // Create a container for React
    const reactRoot = document.createElement('div');
    reactRoot.id = 'youtube-chat-react-root';
    reactRoot.className = 'chat-extension-root'; // Add this line
    reactRoot.style.cssText = `
        
        height: 100%;
        
    `;
    chatPanel.appendChild(reactRoot);

    // Add the panel to the page
    document.body.appendChild(chatPanel);

    // Initialize React
    const root = createRoot(reactRoot);
    root.render(
        <React.StrictMode>
            <ChatPanel />
        </React.StrictMode>
    );

    const primaryContainer = document.getElementById('primary');
    const secondaryContainer = document.getElementById('secondary');
    const pageManager = document.getElementById('page-manager');

    

    if (primaryContainer) {
        primaryContainer.style.marginRight = `${chatPanelWidth}px`;
        primaryContainer.style.width = `calc(100% - ${chatPanelWidth}px)`;
    }

    if (secondaryContainer) {
        secondaryContainer.style.marginRight = `${chatPanelWidth}px`;
    }

    if (pageManager) {
        pageManager.style.marginRight = `${chatPanelWidth}px`;
    }

    // Add the panel to the page (remove the duplicate append at the end)
    document.body.appendChild(chatPanel);
}