import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatArea from './components/ChatArea/ChatArea';
import InputFooter from './components/InputFooter/InputFooter';
import { PanelRightClose, BotMessageSquare } from "lucide-react";
import Button from './components/patterns/Button/Button';
import './globals.css';
import { ChatMessage } from './types';
import DefaultPrompt from './components/patterns/DefaultPrompt/DefaultPrompt';
import { renderToStaticMarkup } from 'react-dom/server';

const chatPanelWidth = 360;
const MIN_CHAT_WIDTH = chatPanelWidth; // absolute minimum
const COLLAPSE_THRESHOLD = MIN_CHAT_WIDTH * 0.4; // 60% smaller than min triggers collapse
const baseZIndex = 1900;
let lastSavedWidth = chatPanelWidth;

let isChatOpen = true;
let resizeThrottleId: number | null = null;

function dispatchResizeThrottled() {
    if (resizeThrottleId !== null) return; // already scheduled
    resizeThrottleId = window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        resizeThrottleId = null;
    }, 1000); // 1 fps
}

function toggleChatPanel(open: boolean) {
    const wrapper = document.getElementById('yt-chat-wrapper');
    const openTab = document.getElementById('yt-chat-open-tab');
    const placeholder = document.getElementById('youtube-chat-panel-placeholder');
    if (!wrapper) return;

    isChatOpen = open;
    if (open) {
        // retrieve stored width
        chrome.storage.local.get(['chatPanelWidth'], (data) => {
            const width = data.chatPanelWidth ? data.chatPanelWidth : lastSavedWidth;
            lastSavedWidth = width;
            const targetWidth = `${width}px`;
            wrapper.style.setProperty('--yt-chat-width', targetWidth);
            if (placeholder) {
                placeholder.style.flexBasis = targetWidth;
                placeholder.style.width = targetWidth;
            }
        });
    } else {
        const targetWidth = '0px';
        wrapper.style.setProperty('--yt-chat-width', targetWidth);
        if (placeholder) {
            placeholder.style.flexBasis = targetWidth;
            placeholder.style.width = targetWidth;
        }
    }

    if (openTab) openTab.style.display = open ? 'none' : 'flex';

    // Notify YouTube player to recalculate layout
    window.dispatchEvent(new Event('resize'));
}

function ensureOpenTab() {
    if (document.getElementById('yt-chat-open-tab')) return;
    const wrapper = document.getElementById('yt-chat-wrapper');
    if (!wrapper) return;

    const openTab = document.createElement('div');
    openTab.id = 'yt-chat-open-tab';
    const zIndex = baseZIndex + 1;
    openTab.style.cssText = `
        width: 42px;
        height: 96px;
        background: var(--bg-base, #fff);
        border-left: 1px solid var(--border-base, rgba(0,0,0,0.1));
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: sticky;
        top: 56px;
        z-index: ${zIndex};
        opacity: 1;
        transition: opacity .2s ease;
    `;

    openTab.innerHTML = renderToStaticMarkup(
        <BotMessageSquare strokeWidth={1} size={24} color="red" style={{ marginLeft: 6, marginRight: 6 }} />
    );

    openTab.addEventListener('mouseenter', () => {
        openTab.style.opacity = '.6';
    });
    openTab.addEventListener('mouseleave', () => {
        openTab.style.opacity = '1';
    });

    openTab.addEventListener('click', () => toggleChatPanel(true));

    wrapper.appendChild(openTab);
}

function ensureResizeHandle() {
    const placeholder = document.getElementById('youtube-chat-panel-placeholder');
    if (!placeholder || document.getElementById('yt-chat-resize-handle')) return;

    placeholder.style.position = 'relative';

    const handle = document.createElement('div');
    handle.id = 'yt-chat-resize-handle';
    const zIndex = baseZIndex + 2;
    handle.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: 8px; 
        height: 100%;
        cursor: col-resize;
        background: transparent;
        opacity: 0;
        transition: opacity .2s ease;
        z-index: ${zIndex};
        pointer-events: auto;
    `;

    // inner visual line
    const grip = document.createElement('span');
    grip.style.cssText = `
        position:absolute;
        left:50%;
        top:50%;
        transform: translate(-50%, -50%);
        width:4px;
        height:40px;
        border-radius:4px;
        background: rgba(255,0,0,.63);
    `;
    handle.appendChild(grip);

    handle.addEventListener('mouseenter', () => {
        handle.style.opacity = '1';
    });
    handle.addEventListener('mouseleave', () => {
        handle.style.opacity = '0';
    });

    let startX = 0;
    let startWidth = chatPanelWidth;
    let currentWidth = chatPanelWidth;
    let draggedBelowMin = false;

    const onPointerMove = (e: PointerEvent) => {
        const delta = startX - e.clientX; // drag left => positive delta
        const tentative = startWidth + delta;
        if (tentative < COLLAPSE_THRESHOLD) draggedBelowMin = true;
        const newWidth = Math.min(Math.max(tentative, MIN_CHAT_WIDTH), window.innerWidth * 0.5);
        const wrapper = document.getElementById('yt-chat-wrapper');
        const placeholder = document.getElementById('youtube-chat-panel-placeholder');
        if (wrapper && placeholder) {
            wrapper.style.setProperty('--yt-chat-width', `${newWidth}px`);
            placeholder.style.flexBasis = `${newWidth}px`;
            placeholder.style.width =
                `${newWidth}px`;
            dispatchResizeThrottled();
            currentWidth = newWidth;
        }
    };

    let prevUserSelect = '';

    const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        handle.releasePointerCapture;

        // restore user select
        document.body.style.userSelect = prevUserSelect;

        // restore user select and final resize
        window.dispatchEvent(new Event('resize'));

        if (draggedBelowMin) {
            draggedBelowMin = false;
            toggleChatPanel(false);
        } else {
            // persist width
            lastSavedWidth = currentWidth;
            chrome.storage.local.set({ chatPanelWidth: currentWidth });
        }
    };

    handle.addEventListener('pointerdown', (e) => {
        if (!isChatOpen) return; // only when open
        e.preventDefault();
        startX = e.clientX;
        const wrapper = document.getElementById('yt-chat-wrapper');
        if (wrapper) {
            const current = parseInt(getComputedStyle(wrapper).getPropertyValue('--yt-chat-width'));
            startWidth = isNaN(current) ? chatPanelWidth : current;
        }

        // disable text selection during drag
        prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    });

    placeholder.appendChild(handle);
}

/**
 * Ensures the React ChatPanel is rendered inside the placeholder div. Safe to call multiple times.
 */
function mountChatPanelIntoPlaceholder() {
    const placeholder = document.getElementById('youtube-chat-panel-placeholder');
    if (!placeholder) {
        console.warn('[YT-Chat] placeholder not found for mounting.');
        return;
    }
    if (placeholder.dataset.reactMounted === 'true') {
        console.info('[YT-Chat] React panel already mounted.');
        return;
    }

    console.info('[YT-Chat] Mounting React ChatPanel…');
    placeholder.dataset.reactMounted = 'true';

    const reactRootDiv = document.createElement('div');
    reactRootDiv.style.cssText = 'height:100%; width:100%; display:flex; flex-direction:column;';
    placeholder.appendChild(reactRootDiv);

    // create open tab and resize handle once UI exists
    ensureOpenTab();
    ensureResizeHandle();

    // Load stored width if present
    chrome.storage.local.get(['chatPanelWidth'], (data) => {
        if (data.chatPanelWidth) {
            lastSavedWidth = data.chatPanelWidth;
            const targetWidth = `${lastSavedWidth}px`;
            const wrapper = document.getElementById('yt-chat-wrapper');
            if (wrapper) wrapper.style.setProperty('--yt-chat-width', targetWidth);
            placeholder.style.flexBasis = targetWidth;
            placeholder.style.width = targetWidth;
        }
    });

    sendVideoMetadataToBackground();

    const root = createRoot(reactRootDiv);
    root.render(
        <React.StrictMode>
            <ChatPanel />
        </React.StrictMode>
    );
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ status: "pong" });
        return true;
    }

    if (request.action === "initializeChatPanel") {
        // Step 2 – inject a flex wrapper that reflows the YouTube page.
        injectFlexWrapper();
        // Immediately respond so the channel doesn't stay open.
        if (sendResponse) sendResponse({ status: "ok" });
        // Return false → we have already responded synchronously.
        return false;
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

function ChatPanel() {

    const [isPanelOpen, setIsPanelOpen] = React.useState(true);
    const [videoId, setVideoId] = React.useState<string | null>(null);
    const defaultPrompts = ["Summarize this video", "What is the main topic?", "Explain this part"];

    React.useEffect(() => {
        const videoMetadata = getVideoMetadata();
        if (videoMetadata) {
            setVideoId(videoMetadata.videoId);
            updateCurrentTime(videoMetadata.videoId);
        }

    }, []);

    // Placeholder toggle handler – actual collapse functionality will come in Step 4.
    const handlePanelToggle = () => {
        toggleChatPanel(false);
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

/**
 * Step 2 of the redesign – create a flex container that houses both YouTube's existing #columns
 * element and a placeholder for the chat panel. This ensures the main page automatically grows
 * or shrinks when the chat width changes, with no manual margin-tweaks.
 */
function injectFlexWrapper() {
    // Bail early if we've already injected.
    const existingWrapper = document.getElementById('yt-chat-wrapper');
    if (existingWrapper) {
        mountChatPanelIntoPlaceholder();
        return;
    }

    const tryInject = (): boolean => {
        const pageManager = document.getElementById('page-manager');
        if (pageManager && pageManager.parentElement) {
            const parent = pageManager.parentElement;

            // Build wrapper
            const wrapper = document.createElement('div');
            wrapper.id = 'yt-chat-wrapper';
            wrapper.style.cssText = `
                display: flex;
                width: 100%;
                align-items: stretch;
            `;
            wrapper.style.setProperty('--yt-chat-width', `${chatPanelWidth}px`);

            parent.insertBefore(wrapper, pageManager);
            wrapper.appendChild(pageManager);

            const placeholderPanel = document.createElement('div');
            placeholderPanel.id = 'youtube-chat-panel-placeholder';
            placeholderPanel.style.cssText = `
                flex: 0 0 var(--yt-chat-width, 320px);
                position: sticky;
                top: 56px;
                height: calc(100vh - 56px);
                overflow-y: hidden;
                background: var(--bg-base, #fff);
                border-left: 1px solid var(--border-base, rgba(0,0,0,0.1));
                z-index: ${baseZIndex};
            `;

            wrapper.appendChild(placeholderPanel);

            // Ensure main content can shrink properly next to our fixed-width panel
            (pageManager as HTMLElement).style.flex = '1 1 auto';
            (pageManager as HTMLElement).style.minWidth = '0';

            console.info('[YT-Chat] Flex wrapper injected beside #page-manager.');

            mountChatPanelIntoPlaceholder();

            // Inject style fixes once
            if (!document.getElementById('yt-chat-fixes')) {
                const style = document.createElement('style');
                style.id = 'yt-chat-fixes';
                style.textContent = `
                    ytd-watch-metadata {
                        max-width: 100% !important;
                        flex: 1 1 auto !important;
                        min-width: 0 !important;
                    }
                `;
                document.head.appendChild(style);
            }

            return true;
        }

        // Fallback to #columns if page-manager not ready
        const columnsEl = document.getElementById('columns');
        if (!columnsEl || !columnsEl.parentElement) {
            return false;
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'yt-chat-wrapper';
        wrapper.style.cssText = `
            display: flex;
            width: 100%;
            align-items: stretch;
        `;
        wrapper.style.setProperty('--yt-chat-width', `${chatPanelWidth}px`);

        const parent = columnsEl.parentElement;
        parent.insertBefore(wrapper, columnsEl);
        wrapper.appendChild(columnsEl);

        (columnsEl as HTMLElement).style.flex = '1 1 auto';
        (columnsEl as HTMLElement).style.minWidth = '0';

        const placeholderPanel = document.createElement('div');
        placeholderPanel.id = 'youtube-chat-panel-placeholder';
        placeholderPanel.style.cssText = `
            flex: 0 0 var(--yt-chat-width, 320px);
            position: sticky;
            top: 56px;
            height: calc(100vh - 56px);
            overflow-y: hidden;
            background: var(--bg-base, #fff);
            border-left: 1px solid var(--border-base, rgba(0,0,0,0.1));
            z-index: ${baseZIndex};
        `;

        wrapper.appendChild(placeholderPanel);

        console.info('[YT-Chat] Flex wrapper injected beside #columns (fallback).');

        mountChatPanelIntoPlaceholder();

        if (!document.getElementById('yt-chat-fixes')) {
            const style = document.createElement('style');
            style.id = 'yt-chat-fixes';
            style.textContent = `
                ytd-watch-metadata {
                    max-width: 100% !important;
                    flex: 1 1 auto !important;
                    min-width: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }

        return true;
    };

    // Attempt immediately; if it fails, observe DOM until #columns appears.
    if (tryInject()) {
        return;
    }

    const obs = new MutationObserver(() => {
        if (tryInject()) {
            obs.disconnect();
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

// Keyboard shortcut Alt + C to toggle panel
window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyC') {
        toggleChatPanel(!isChatOpen);
    }
});