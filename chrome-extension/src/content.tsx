import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatArea from './components/ChatArea/ChatArea';
import InputFooter from './components/InputFooter/InputFooter';
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import Button from './components/patterns/Button/Button';
import './globals.css';
import { ChatMessage } from './types';
import DefaultPrompt from './components/patterns/DefaultPrompt/DefaultPrompt';

const chatPanelWidth = 333;

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
            return;
        }
    });

    if (ytInitialPlayerResponse === undefined) {
        window.location.reload();
        return null;
    }

    const videoIdFromYtInitialPlayerResponse = ytInitialPlayerResponse.videoDetails.videoId;
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdFromUrl = urlParams.get('v');
    if (videoIdFromUrl !== videoIdFromYtInitialPlayerResponse) {
        window.location.reload();
        return null;
    }

    let captionUrl: string | null = null;
    if (ytInitialPlayerResponse.captions) {
        const captionsTracks = ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        const englishTrack = captionsTracks.find((track: any) => track.languageCode === 'en');
        captionUrl = englishTrack ? englishTrack.baseUrl : captionsTracks[0]?.baseUrl || null;
    }

    return { videoId: videoIdFromYtInitialPlayerResponse, captionUrl };
}

function updateCurrentTime(videoId: string) {
    setInterval(() => {
        const currentTimeElement = document.querySelector('.ytp-time-current');
        const currentTime = currentTimeElement ? currentTimeElement.textContent : null;

        if (currentTime) {
            chrome.runtime.sendMessage({ action: "updateCurrentTime", videoId, currentTime });
        }
    }, 1000);
}

function addChatButton() {
    // Create a new button element
    const chatButton = document.createElement('button');
    chatButton.className = 'ytp-button';
    chatButton.title = 'Toggle Chat Panel';
    chatButton.ariaLabel = 'Toggle Chat Panel';

    // Create the inner div for text
    const textDiv = document.createElement('div');
    textDiv.className = 'ytp-fullerscreen-edu-text';
    textDiv.textContent = '💬';

    // Create the inner div for the icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'ytp-fullerscreen-edu-chevron';

    // Create the SVG icon
    // const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // svgIcon.setAttribute('height', '100%');
    // svgIcon.setAttribute('viewBox', '0 0 24 24');
    // svgIcon.setAttribute('width', '100%');

    // Create the path for the SVG
    // const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // path.setAttribute('d', 'M7.41,8.59L12,13.17l4.59-4.58L18,10l-6,6l-6-6L7.41,8.59z');
    // path.setAttribute('fill', '#fff');

    // // Append the path to the SVG
    // svgIcon.appendChild(path);

    // Append the SVG to the icon div
    // iconDiv.appendChild(svgIcon);

    // Append the text and icon divs to the button
    chatButton.appendChild(textDiv);
    // chatButton.appendChild(iconDiv);

    // Insert the button as the first child of the ytp-right-controls div
    const rightControls = document.querySelector('.ytp-right-controls');
    if (rightControls) {
        rightControls.insertBefore(chatButton, rightControls.firstChild);
    }

    // Add event listener to toggle the chat panel
    chatButton.addEventListener('click', () => {
        const panel = document.getElementById('youtube-chat-panel');
        if (panel) {
            const isOpen = panel.style.transform !== 'translateX(0)';
            panel.style.transform = isOpen ? 'translateX(0)' : `translateX(${chatPanelWidth}px)`;
        }
    });
}

function ChatPanel() {

    const [isPanelOpen, setIsPanelOpen] = React.useState(true);
    const [videoId, setVideoId] = React.useState<string | null>(null);
    const defaultPrompts = ["Summarize this video", "What is the main topic?", "Explain this part"];

    React.useEffect(() => {
        addChatButton();
        const videoMetadata = getVideoMetadata();
        if (videoMetadata) {
            setVideoId(videoMetadata.videoId);
            updateCurrentTime(videoMetadata.videoId);
        }

    }, []);

    const adjustPageLayout = (isOpen: boolean) => {
        const elements = {
            primary: document.getElementById('primary'),
            secondary: document.getElementById('secondary'),
            pageManager: document.getElementById('page-manager')
        };

        const styles = {
            marginRight: isOpen ? `${chatPanelWidth}px` : '0',
            width: isOpen ? `calc(100% - ${chatPanelWidth}px)` : '100%',
            transition: 'all 0.3s ease'
        };

        Object.values(elements).forEach(element => {
            if (element) {
                Object.assign(element.style, styles);
            }
        });
    };

    adjustPageLayout(true);

    const handlePanelToggle = () => {
        const panel = document.getElementById('youtube-chat-panel');
        const floatingButton = document.getElementById('youtube-chat-floating-button');

        if (isPanelOpen) {
            // Close panel
            if (panel) panel.style.transform = `translateX(${chatPanelWidth}px)`;
            if (floatingButton) floatingButton.style.display = 'flex';
            adjustPageLayout(false);
        } else {
            // Open panel
            if (panel) panel.style.transform = 'translateX(0)';
            if (floatingButton) floatingButton.style.display = 'none';
            adjustPageLayout(true);
        }
        setIsPanelOpen(!isPanelOpen);
    };

    React.useEffect(() => {
        const observer = new MutationObserver(() => {
            adjustPageLayout(isPanelOpen);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => observer.disconnect();
    }, [isPanelOpen]);

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
            {chatHistory.length <= 1 && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '8px',
                    boxSizing: 'border-box'
                }}>
                    {defaultPrompts.map((prompt, index) => (
                        <DefaultPrompt
                            key={index}
                            content={prompt}
                            onClick={() => handleMessageSend(prompt)}
                        />
                    ))}
                </div>
            )}
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
    sendVideoMetadataToBackground();

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
    // document.body.appendChild(chatPanel);

    // Initialize React
    const root = createRoot(reactRoot);
    root.render(
        <React.StrictMode>
            <ChatPanel />
        </React.StrictMode>
    );

    const pageManager = document.getElementById('page-manager');

    if (pageManager) {
        // Append the chat panel directly next to the pageManager
        pageManager.parentNode?.insertBefore(chatPanel, pageManager.nextSibling);
    }

    // Add the panel to the page (remove the duplicate append at the end)
    // document.body.appendChild(chatPanel);
}