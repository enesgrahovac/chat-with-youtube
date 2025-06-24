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
const marginTop = 56;

let lastSavedWidth = chatPanelWidth;

let isChatOpen = true;
let resizeThrottleId: number | null = null;

function dispatchResizeThrottled() {
    if (resizeThrottleId !== null) return; // already scheduled
    resizeThrottleId = window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        resizeThrottleId = null;
    }, 500); // 2 fps
}

function updatePageContentShift(width: number) {
    const ytdApp = document.querySelector('ytd-app') as HTMLElement | null;
    if (!ytdApp) return;

    // Shift content visually and also shrink its actual width so YouTube's own
    // responsive logic (ResizeObserver + CSS breakpoints) reacts as if the
    // browser window itself had become narrower.
    ytdApp.style.marginRight = `${width}px`;

    // After adjusting the visual width, also mirror YouTube's own responsive attribute
    // behaviour so that the layout (e.g. single-column vs two-column) switches just
    // like it does when the browser window itself is resized.
    updateFlexyBreakpoints(window.innerWidth - width);
}

/**
 * Mimic YouTube's internal responsive logic by toggling attributes on
 * <ytd-watch-flexy>. This is a heuristic based on observed breakpoints.
 */
function updateFlexyBreakpoints(availableWidth: number) {
    const flexy = document.querySelector('ytd-watch-flexy') as HTMLElement | null;
    if (!flexy) return;

    // Large vs small window flags (~1330px breakpoint).
    if (availableWidth >= 1330) {
        flexy.setAttribute('flexy-large-window_', '');
        flexy.removeAttribute('flexy-small-window_');
    } else {
        flexy.removeAttribute('flexy-large-window_');
        flexy.setAttribute('flexy-small-window_', '');
    }

    // Two-column layout flag (~1000px breakpoint).
    if (availableWidth >= 1000) {
        flexy.setAttribute('is-two-columns_', '');
    } else {
        flexy.removeAttribute('is-two-columns_');
    }
}

function toggleChatPanel(open: boolean) {
    const wrapper = document.getElementById('yt-chat-wrapper') as HTMLElement | null;
    const openTab = document.getElementById('yt-chat-open-tab') as HTMLElement | null;
    if (!wrapper) return;

    isChatOpen = open;

    // Persist the open/closed state so it survives page navigations and refreshes
    chrome.storage.local.set({ chatPanelOpen: open });

    if (open) {
        chrome.storage.local.get(['chatPanelWidth'], (data) => {
            const width = data.chatPanelWidth ? data.chatPanelWidth : lastSavedWidth;
            lastSavedWidth = width;
            wrapper.style.setProperty('--yt-chat-width', `${width}px`);
            wrapper.style.width = `${width}px`;
            updatePageContentShift(width);
        });
    } else {
        wrapper.style.setProperty('--yt-chat-width', `0px`);
        wrapper.style.width = `0px`;
        updatePageContentShift(0);
    }

    if (openTab) openTab.style.display = open ? 'none' : 'flex';

    // still notify for good measure
    window.dispatchEvent(new Event('resize'));
}

function ensureOpenTab() {
    if (document.getElementById('yt-chat-open-tab')) return;

    const openTab = document.createElement('div');
    openTab.id = 'yt-chat-open-tab';

    const openButtonMargin = 6;
    // Custom tooltip (uses YouTube-like styling)
    const tooltipOuter = document.createElement('div');
    tooltipOuter.style.cssText = `
        position: fixed;
        right: 58px; /* tab width (42) + margin (6) + 10px */
        top: ${openButtonMargin + marginTop}px;  /* roughly vertically centred on the tab */
        z-index: ${baseZIndex};
        pointer-events: none;
        display: none;
    `;

    const tooltipInner = document.createElement('div');
    tooltipInner.style.cssText = `
        background: #fff;
        color: #000;
        font-family: Roboto, Arial, sans-serif;
        font-size: 12px;
        font-weight: 500;
        padding: 8px 10px;
        border: 1px solid rgba(0,0,0,0.15);
        border-radius: 2px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        white-space: nowrap;
        position: relative;
    `;
    tooltipInner.textContent = 'Open YouTube Copilot chat';

    // caret
    const caret = document.createElement('div');
    caret.style.cssText = `
        position: absolute;
        top: 50%;
        right: -6px;
        margin-top: -6px;
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 6px solid #fff;
    `;
    tooltipInner.appendChild(caret);
    tooltipOuter.appendChild(tooltipInner);
    document.body.appendChild(tooltipOuter);

    openTab.style.cssText = `
        width: 42px;
        height: 42px;
        margin: ${openButtonMargin}px;
        border-radius: 6px;
        background: var(--bg-base, #fff);
        border-left: 1px solid var(--border-base, rgba(0,0,0,0.1));
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: fixed;
        right: 0;
        top: ${marginTop}px;
        z-index: ${baseZIndex + 1};
        opacity: .6;
        transition: opacity .2s ease;
    `;

    openTab.innerHTML = renderToStaticMarkup(
        <BotMessageSquare strokeWidth={1} size={24} color="red" style={{ marginLeft: 6, marginRight: 6 }} />
    );

    openTab.addEventListener('mouseenter', () => {
        openTab.style.opacity = '1';
        tooltipOuter.style.display = 'block';
    });
    openTab.addEventListener('mouseleave', () => {
        openTab.style.opacity = '.6';
        tooltipOuter.style.display = 'none';
    });

    openTab.addEventListener('click', () => {
        tooltipOuter.style.display = 'none';
        toggleChatPanel(true);
    });

    document.body.appendChild(openTab);
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
        const wrapper = document.getElementById('yt-chat-wrapper') as HTMLElement | null;
        if (wrapper) {
            wrapper.style.setProperty('--yt-chat-width', `${newWidth}px`);
            wrapper.style.width = `${newWidth}px`;
            updatePageContentShift(newWidth);
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

    // Load stored width and open state
    chrome.storage.local.get(['chatPanelWidth', 'chatPanelOpen'], (data) => {
        if (data.chatPanelWidth) {
            lastSavedWidth = data.chatPanelWidth;
        }
        const shouldOpen = data.chatPanelOpen !== undefined ? data.chatPanelOpen : true;
        toggleChatPanel(shouldOpen);
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

function getVideoMetadata(): { videoId: string; captionUrl: string | null } | null {
    const scripts = document.querySelectorAll('script');
    let ytInitialPlayerResponse: any = undefined;

    scripts.forEach(script => {
        if (script.textContent && script.textContent.includes('ytInitialPlayerResponse')) {
            // Capture the full (multi-line) ytInitialPlayerResponse assignment. The dotAll flag (/s)
            // lets the dot match newlines, and the non-greedy quantifier prevents overshooting.
            // We intentionally stop right before the next "var meta" statement that YouTube inserts
            // after the player response.
            const jsonString = script.textContent.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?})(?=;\s*var\s+meta\s*=)/);
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

        const chosenTrack = englishTrack ?? captionsTracks[0];
        if (chosenTrack) {
            // Prefer the fully-featured JSON3 URL if present (handles ASR tracks)
            captionUrl = chosenTrack.url || chosenTrack.baseUrl || null;

            // If the track only gives us baseUrl, leave it untouched (XML). The URL form that already
            // contains fmt=json3 also carries the required pot/potc tokens, so we must not mutate it.
        }
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

/**
 * Waits until any preroll advertisement has finished playing before resolving.
 * It observes the presence of the `ad-showing` class on YouTube's main
 * `.html5-video-player` element.
 * If no ad is currently showing, the promise resolves immediately.
 * A safety timeout ensures the promise always resolves within `timeoutMs`.
 */
function waitForAdToFinish(timeoutMs = 30000): Promise<void> {
    return new Promise((resolve) => {
        const player = document.querySelector('.html5-video-player') as HTMLElement | null;
        if (!player || !player.classList.contains('ad-showing')) {
            resolve(); // No ad playing – continue immediately
            return;
        }

        const pollInterval = 500;
        const intervalId = setInterval(() => {
            if (!player.classList.contains('ad-showing')) {
                clearInterval(intervalId);
                clearTimeout(timeoutId);
                resolve();
            }
        }, pollInterval);

        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            resolve();
        }, timeoutMs);
    });
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

            // Trigger CC network request *after* any preroll ad has finished so we capture
            // captions for the actual video rather than the advertisement.
            waitForAdToFinish().then(() => {
                // Wait a bit for the player controls to render.
                setTimeout(() => {
                    const ccButton = document.querySelector<HTMLButtonElement>('.ytp-subtitles-button');
                    if (ccButton) {
                        const initiallyPressed = ccButton.getAttribute('aria-pressed') === 'true';
                        if (!initiallyPressed) {
                            ccButton.click(); // turn on
                            // turn off after a short delay so viewer settings stay unchanged
                            setTimeout(() => {
                                ccButton.click();
                            }, 1200);
                        }
                    }
                }, 1000);
            });
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

    const wrapper = document.createElement('div');
    wrapper.id = 'yt-chat-wrapper';
    wrapper.style.cssText = `
        position: fixed;
        right: 0;
        top: ${marginTop}px;
        height: calc(100vh - ${marginTop}px);
        width: var(--yt-chat-width, 0px); /* start collapsed to avoid flash */
        display: flex;
        z-index: ${baseZIndex};
    `;
    wrapper.style.setProperty('--yt-chat-width', `0px`);

    const placeholderPanel = document.createElement('div');
    placeholderPanel.id = 'youtube-chat-panel-placeholder';
    placeholderPanel.style.cssText = `
        width: 100%;
        height: 100%;
        overflow-y: hidden;
        background: var(--bg-base, #fff);
        border-left: 1px solid var(--border-base, rgba(0,0,0,0.1));
    `;

    wrapper.appendChild(placeholderPanel);
    document.body.appendChild(wrapper);

    // Do not shift content yet; mountChatPanelIntoPlaceholder() will
    // decide whether to expand and shift based on persisted state.

    // inject smooth transition once
    if (!document.getElementById('yt-chat-shift-transition')) {
        const style = document.createElement('style');
        style.id = 'yt-chat-shift-transition';
        style.textContent = `
            ytd-app { transition: margin-right .2s ease; }
        `;
        document.head.appendChild(style);
    }

    mountChatPanelIntoPlaceholder();
}

// Keyboard shortcut Alt + C to toggle panel
window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyC') {
        toggleChatPanel(!isChatOpen);
    }
});

// Ensure breakpoints update on any window resize (initial resize events are dispatched by the
// extension itself when the panel opens/closes or is dragged).
window.addEventListener('resize', () => {
    const wrapper = document.getElementById('yt-chat-wrapper') as HTMLElement | null;
    const chatWidth = wrapper ? parseInt(getComputedStyle(wrapper).getPropertyValue('--yt-chat-width')) || 0 : 0;
    updateFlexyBreakpoints(window.innerWidth - chatWidth);
});