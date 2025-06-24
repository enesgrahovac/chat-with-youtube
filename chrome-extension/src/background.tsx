import { ChatMessage, ChatGPTMessage } from './types';
import { convertToChatGPTMessages, captionsToXML } from './utils';

const videoCaptionsMap = new Map<string, { captions: string | null, currentTime: number | null }>();


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const isPageLoadingOrComplete = ((changeInfo.status === 'complete'));
    if (!isPageLoadingOrComplete) {
        return;
    }

    if (isPageLoadingOrComplete) {
        setTimeout(() => {
            if (tab.url?.includes('youtube.com/watch')) {
                verifyContentScript(tabId, () => {
                    chrome.tabs.sendMessage(tabId, { action: "initializeChatPanel" });
                });
            }
        }, 0);
    }
});

const callLLM = async (messages: ChatMessage[], videoId: string) => {
    const captionsData = videoCaptionsMap.get(videoId);
    if (!captionsData || !captionsData.captions || captionsData.currentTime === null) {
        console.warn('[YT-Chat] Captions not yet available – likely because an advertisement is still playing or captions have not loaded.');

        // Craft a helpful fallback response for the user. We bypass the LLM call to save tokens.
        return "I'm still waiting for the video's captions to load (an advertisement may still be playing). Please let the video start, then ask again.";
    }

    const currentTime = captionsData.currentTime;
    const captions = captionsData.captions;
    const contextWindowInTime = 30 * 60;

    const captionsXML = captionsToXML(captions, currentTime, contextWindowInTime);
    console.log('captionsXML', captionsXML);
    const chatGPTMessages = convertToChatGPTMessages(messages);
    const systemMessage: ChatGPTMessage = {
        role: "system",
        content: `The user is watching a YouTube video. Captions XML:\n${captionsXML}\n\nCurrent time: ${currentTime} seconds.`
    }
    const aiResponse = await callChatGPT([systemMessage, ...chatGPTMessages]);
    return aiResponse;
}

const callChatGPT = async (messages: ChatGPTMessage[]) => {
    console.log('messages to chatGpt', messages);
    try {
        console.log('Calling ChatGPT', process.env.OPENAI_API_KEY);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4.1-nano",
                messages
            })
        });

        if (!response.ok) {
            throw new Error(JSON.stringify({ error: response.statusText, body: response.body }));
        }

        const data = await response.json();
        console.log('ChatGPT response', data);
        const aiResponse = data.choices[0].message.content;
        return aiResponse; // Assuming the API returns the response in a JSON format
    } catch (error) {
        console.error('Failed to call ChatGPT:', error);
        return null;
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processMessage") {
        const chatMessages: ChatMessage[] = request.chatMessages;
        const videoId = request.videoId;

        // Process the message and generate a response
        callLLM(chatMessages, videoId).then(aiResponse => {
            // Send the response back to the content script
            sendResponse({ content: aiResponse });

            // Return true to indicate you want to send a response asynchronously
        }).catch(error => {
            console.error('Error processing message:', error);
            sendResponse({ content: null });
        });

        return true; // Keep this to indicate async response
    }
    else if (request.action === "updateCurrentTime") {
        const { videoId, currentTime } = request;
        // convert currentTime to seconds
        // The currentTime is in the format of 00:00:00
        const timeInSeconds: number = currentTime.split(':').map(Number).reverse().reduce((acc: number, curr: number, index: number) => acc + curr * Math.pow(60, index), 0);
        console.log('timeInSeconds', timeInSeconds);

        const existingData = videoCaptionsMap.get(videoId) || { captions: null, currentTime: null };
        videoCaptionsMap.set(videoId, { ...existingData, currentTime: timeInSeconds });
        console.log(`Updated current time for video ${videoId}: ${timeInSeconds}`);
    }
    else if (request.action === "getVideoCaptions") {
        // const videoId = request.videoId;
        // if (request && request.videoId && request.captionUrl !== undefined) {
        //     fetch(request.captionUrl, { credentials: 'include' })
        //         .then(response => {
        //             if (!response.ok) {
        //                 throw new Error(`Failed to fetch captions: ${response.statusText}`);
        //             }
        //             return response.text();
        //         })
        //         .then(captions => {
        //             const existingData = videoCaptionsMap.get(videoId) || { captions: null, currentTime: null };
        //             videoCaptionsMap.set(videoId, { ...existingData, captions });
        //             console.log('videoCaptionsMap', videoCaptionsMap);
        //         })
        //         .catch(error => {
        //             console.error('Error fetching video captions:', error);
        //         });
        // }
    }
});

function verifyContentScript(tabId: number, callback: () => void, retries = 3, delay = 500) {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== "pong") {

            if (retries > 0) {

                setTimeout(() => verifyContentScript(tabId, callback, retries - 1, delay), delay);
            } else {

                chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['dist/content.js']
                }, () => {
                    if (!chrome.runtime.lastError) {
                        callback();
                    } else {
                        console.error(`Error re-injecting script: ${chrome.runtime.lastError.message}`);
                    }
                });
            }
        } else {


            callback();
        }
    });
}

// Observe caption requests and harvest the fully-signed URL (includes pot/potc).
chrome.webRequest.onCompleted.addListener(
    (details) => {
        try {
            const url = details.url;
            if (!url.includes('/api/timedtext')) return;
            console.log("incoming details", details)

            const urlObj = new URL(url);
            const videoId = urlObj.searchParams.get('v');
            if (!videoId) return;

            const existing = videoCaptionsMap.get(videoId);
            if (existing && existing.captions) return; // already cached

            // Fetch the captions with cookies so it succeeds regardless of tokens.
            fetch(url, { credentials: 'include' })
                .then(resp => {
                    if (!resp.ok) throw new Error(`captions fetch failed: ${resp.status}`);
                    return resp.text();
                })
                .then(text => {
                    const prev = videoCaptionsMap.get(videoId) || { captions: null, currentTime: null };
                    console.log('text', text)
                    videoCaptionsMap.set(videoId, { ...prev, captions: text });
                    console.log('[YT-Chat] Captions harvested via webRequest', videoId);
                })
                .catch(err => console.error('[YT-Chat] Captions harvest error', err));
        } catch (err) {
            console.error('[YT-Chat] webRequest processing error', err);
        }
    },
    { urls: ['*://www.youtube.com/api/timedtext*'] }
);

