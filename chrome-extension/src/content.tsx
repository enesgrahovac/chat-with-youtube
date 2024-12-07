import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatArea from './components/ChatArea/ChatArea';
import InputFooter from './components/InputFooter/InputFooter';
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import Button from './components/patterns/Button/Button';
import './globals.css';
import { ChatMessage } from './types';
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

// type YtInitialPlayerResponse = {
//     videoDetails: {
//         videoId: string;
//     };
//     captions?: {
//         playerCaptionsTracklistRenderer: {
//             captionTracks: Array<{
//                 languageCode: string;
//                 baseUrl: string;
//             }>;
//         };
//     };
// };

function getVideoMetadata(): { videoId: string; captionUrl: string | null } | null {
    const scripts = document.querySelectorAll('script');
    let ytInitialPlayerResponse: any = undefined;

    scripts.forEach(script => {
        if (script.textContent && script.textContent.includes('ytInitialPlayerResponse')) {
            const jsonString = script.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
            if (jsonString && jsonString[1]) {
                try {
                    ytInitialPlayerResponse = JSON.parse(jsonString[1]);
                } catch (error) {
                    console.error('Failed to parse ytInitialPlayerResponse JSON:', error);
                }
            }
            // end the loop
            return;
        }
    });

    if (ytInitialPlayerResponse === undefined) {
        // Reload the page
        window.location.reload();
        return null;
    }

    const videoIdFromYtInitialPlayerResponse = ytInitialPlayerResponse.videoDetails.videoId;

    // if the video id from the url isn't the same as the video id in the ytInitialPlayerResponse, then reload the page
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdFromUrl = urlParams.get('v');
    if (videoIdFromUrl !== videoIdFromYtInitialPlayerResponse) {
        window.location.reload();
        return null;
    }

    let captionUrl: string | null = null;
    if (ytInitialPlayerResponse.captions) {
        const captionsTracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;

        // Iterate over the captions tracks to find the one with languageCode 'en'
        const englishTrack = captionsTracks.find((track: any) => track.languageCode === 'en');

        // If an English track is found, use its baseUrl, otherwise use the first track's baseUrl
        captionUrl = englishTrack ? englishTrack.baseUrl : captionsTracks[0]?.baseUrl || null;
    }

    return { videoId: videoIdFromYtInitialPlayerResponse, captionUrl };
}

function ChatPanel() {

    const [isPanelOpen, setIsPanelOpen] = React.useState(true);
    const [videoId, setVideoId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const videoMetadata = getVideoMetadata();
        if (videoMetadata) {
            setVideoId(videoMetadata.videoId);
        }
    }, []);

    const handlePanelToggle = async () => {
        const panel = document.getElementById('youtube-chat-panel');
        const primaryContainer = document.getElementById('primary');
        const secondaryContainer = document.getElementById('secondary');
        const pageManager = document.getElementById('page-manager');
        const floatingButton = document.getElementById('youtube-chat-floating-button');
        const chatPanelWidth = 333;

        if (isPanelOpen) {
            // Close panel
            if (panel) panel.style.transform = `translateX(${chatPanelWidth}px)`;
            if (primaryContainer) primaryContainer.style.marginRight = '0';
            if (secondaryContainer) secondaryContainer.style.marginRight = '0';
            if (pageManager) pageManager.style.marginRight = '0';
            if (floatingButton) floatingButton.style.display = 'flex'; // Show floating button

        } else {
            // Open panel
            console.log('Opening panel');
            if (panel) panel.style.transform = 'translateX(0)';
            if (primaryContainer) primaryContainer.style.marginRight = `${chatPanelWidth}px`;
            if (secondaryContainer) secondaryContainer.style.marginRight = `${chatPanelWidth}px`;
            if (pageManager) pageManager.style.marginRight = `${chatPanelWidth}px`;
            if (floatingButton) floatingButton.style.display = 'none'; // Hide floating button
            console.log('Getting video metadata');

        }
        setIsPanelOpen(!isPanelOpen);
    };

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
        const userMessage: ChatMessage = {
            isHuman: true,
            content: message,
            timestamp: new Date()
        };

        const newChatHistory = [...chatHistory, userMessage];
        setChatHistory(prev => newChatHistory);

        // Add animated placeholder message
        let dotCount = 1;
        const intervalId = setInterval(() => {
            const dots = '.'.repeat(dotCount);
            const placeholderMessage: ChatMessage = {
                isHuman: false,
                content: dots,
                timestamp: new Date()
            };
            setChatHistory(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && !lastMessage.isHuman) {
                    // Replace the last placeholder message
                    return [...prev.slice(0, -1), placeholderMessage];
                }
                // Add new placeholder message
                return [...prev, placeholderMessage];
            });
            dotCount = dotCount === 3 ? 1 : dotCount + 1;
        }, 500); // Update every 500ms

        // Send message to background script
        chrome.runtime.sendMessage({ action: "processMessage", chatMessages: newChatHistory, videoId: videoId }, (response) => {
            // Stop the animation
            clearInterval(intervalId);

            // Remove the last message (placeholder)
            setChatHistory(prev => prev.slice(0, -1));

            if (response && response.content) {
                // Add AI response from background script
                const aiResponse = {
                    isHuman: false,
                    content: response.content,
                    timestamp: new Date()
                };
                setChatHistory(prev => [...prev, aiResponse]);
            } else {
                console.error('Failed to get response from background script');
            }
        });
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
                height: '50px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
            }}>
                <Button
                    variant="ghost"
                    icon={<PanelRightClose strokeWidth={1} size={24} />}
                    onClick={handlePanelToggle}
                />
            </div>
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

function sendVideoMetadataToBackground() {
    const videoMetadata = getVideoMetadata();
    console.log('Video Metadata on Panel Creation:', videoMetadata);
    chrome.runtime.sendMessage({ action: "getVideoCaptions", videoId: videoMetadata?.videoId, captionUrl: videoMetadata?.captionUrl });
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
        transition: transform 0.3s ease;
    `;

    const videoMetadata = sendVideoMetadataToBackground();



    const floatingButton = document.createElement('div');
    floatingButton.id = 'youtube-chat-floating-button';
    floatingButton.style.cssText = `
        position: fixed;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        background-color: red;
        border-radius: 50%;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 2001;
    `;

    // Create a container for the icon
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    `;
    floatingButton.appendChild(iconContainer);

    // Render the PanelRightOpen icon using React
    const iconRoot = createRoot(iconContainer);
    iconRoot.render(<PanelRightOpen color="white" strokeWidth={1} size={24} />);

    floatingButton.addEventListener('click', () => {
        const panel = document.getElementById('youtube-chat-panel');
        if (panel) {
            panel.style.transform = 'translateX(0)';
            floatingButton.style.display = 'none';
            const primaryContainer = document.getElementById('primary');
            const secondaryContainer = document.getElementById('secondary');
            const pageManager = document.getElementById('page-manager');
            if (primaryContainer) primaryContainer.style.marginRight = `${chatPanelWidth}px`;
            if (secondaryContainer) secondaryContainer.style.marginRight = `${chatPanelWidth}px`;
            if (pageManager) pageManager.style.marginRight = `${chatPanelWidth}px`;
        }
    });

    document.body.appendChild(floatingButton);

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