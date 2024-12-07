import { ChatMessage, ChatGPTMessage } from './types';

export const convertToChatGPTMessages = (messages: ChatMessage[]): ChatGPTMessage[] => {
    return messages.map(message => ({
        role: message.isHuman ? 'user' : 'assistant',
        content: message.content
    }));
}