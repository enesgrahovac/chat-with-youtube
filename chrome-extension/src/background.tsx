import { ChatMessage, ChatGPTMessage } from './types';
import { convertToChatGPTMessages } from './utils';
import { DOMParser } from 'xmldom';

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
        console.error('No captions or current time available');
        return null;
    }

    const currentTime = captionsData.currentTime;
    const captions = captionsData.captions;
    const contextWindowInTime = 30 * 60;

    // Parse the XML captions
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(captions, "text/xml");
    const texts = xmlDoc.getElementsByTagName("text");

    // Filter captions within the time range
    const filteredCaptions = Array.from(texts).filter(text => {
        const start = parseFloat(text.getAttribute("start") || "0");
        return start >= (currentTime - contextWindowInTime) && start <= (currentTime + contextWindowInTime);
    }).map(text => text.textContent).join(' ');

    const chatGPTMessages = convertToChatGPTMessages(messages);
    const systemMessage: ChatGPTMessage = {
        role: "system",
        content: `The user is watching a YouTube video with the following captions: ${filteredCaptions}\n\n The current time the user is watching at is ${currentTime} seconds.`
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
        const videoId = request.videoId;
        if (request && request.videoId && request.captionUrl !== undefined) {
            fetch(request.captionUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch captions: ${response.statusText}`);
                    }
                    return response.text();
                })
                .then(captions => {
                    const existingData = videoCaptionsMap.get(videoId) || { captions: null, currentTime: null };
                    videoCaptionsMap.set(videoId, { ...existingData, captions });
                    console.log('videoCaptionsMap', videoCaptionsMap);
                })
                .catch(error => {
                    console.error('Error fetching video captions:', error);
                });
        }
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

