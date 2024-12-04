import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatArea from './components/ChatArea/ChatArea';

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

function createChatPanel() {
    // Check if panel already exists
    if (document.getElementById('youtube-chat-panel')) {
        return;
    }

    // Create the chat panel
    const chatPanel = document.createElement('div');
    chatPanel.id = 'youtube-chat-panel';
    chatPanel.style.cssText = `
        position: fixed;
        top: 56px; /* YouTube's header height */
        right: 0;
        width: 400px;
        height: calc(100vh - 56px);
        background-color: white;
        border-left: 1px solid #e0e0e0;
        z-index: 2000;
        box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
        overflow-y: auto; /* Add scrolling for chat content */
    `;

    // Create a container for React
    const reactRoot = document.createElement('div');
    reactRoot.id = 'youtube-chat-react-root';
    chatPanel.appendChild(reactRoot);

    // Add the panel to the page
    document.body.appendChild(chatPanel);

    // Initialize React
    const root = createRoot(reactRoot);
    root.render(
        <React.StrictMode>
            <ChatArea
                chatHistory={[
                    {
                        isHuman: true,
                        content: "Hello! This is a test message.",
                        timestamp: new Date()
                    },
                    {
                        isHuman: false,
                        content: "Hi! I'm your YouTube assistant.",
                        timestamp: new Date()
                    }
                ]}
            />
        </React.StrictMode>
    );

    const primaryContainer = document.getElementById('primary');
    const secondaryContainer = document.getElementById('secondary');
    const pageManager = document.getElementById('page-manager');

    if (primaryContainer) {
        primaryContainer.style.marginRight = '400px';
        primaryContainer.style.width = 'calc(100% - 400px)';
    }

    if (secondaryContainer) {
        secondaryContainer.style.marginRight = '400px';
    }

    if (pageManager) {
        pageManager.style.marginRight = '400px';
    }

    // Add the panel to the page (remove the duplicate append at the end)
    document.body.appendChild(chatPanel);
}