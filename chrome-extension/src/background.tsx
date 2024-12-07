import { ChatMessage } from './types';
import { convertToChatGPTMessages } from './utils';
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

const callChatGPT = async (messages: ChatMessage[]) => {
    const chatGPTMessages = convertToChatGPTMessages(messages);
    try {
        console.log('Calling ChatGPT', process.env.OPENAI_API_KEY);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    // {
                    //     role: "system",
                    //     content: "You are a helpful assistant."
                    // },
                    ...chatGPTMessages
                ]
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

        // Process the message and generate a response
        callChatGPT(chatMessages).then(aiResponse => {
            // Send the response back to the content script
            sendResponse({ content: aiResponse });

            // Return true to indicate you want to send a response asynchronously
        }).catch(error => {
            console.error('Error processing message:', error);
            sendResponse({ content: null });
        });

        return true; // Keep this to indicate async response
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

