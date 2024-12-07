export type ChatMessage = {
    isHuman: boolean;
    content: string;
    timestamp: Date;
}

export type ChatGPTMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
}