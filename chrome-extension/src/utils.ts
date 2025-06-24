import { ChatMessage, ChatGPTMessage } from './types';
import { DOMParser } from 'xmldom';

export const convertToChatGPTMessages = (messages: ChatMessage[]): ChatGPTMessage[] => {
    return messages.map(message => ({
        role: message.isHuman ? 'user' : 'assistant',
        content: message.content
    }));
}

export const captionsToXML = (captionsRaw: string, currentTime: number, windowSec: number = 1800): string => {
    const xmlLines: string[] = [];

    const escapeXML = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const withinWindow = (start: number) =>
        start >= (currentTime - windowSec) && start <= (currentTime + windowSec);

    const append = (start: number, end: number, text: string) => {
        if (!withinWindow(start)) return;
        const safeText = escapeXML(text.trim());
        if (!safeText) return;
        xmlLines.push(`<caption start="${start.toFixed(3)}" end="${end.toFixed(3)}">${safeText}</caption>`);
    }

    // Try JSON3 format first
    try {
        const json = JSON.parse(captionsRaw);
        if (json.events && Array.isArray(json.events)) {
            json.events.forEach((ev: any) => {
                const startSec = (ev.tStartMs ?? 0) / 1000;
                const durSec = (ev.dDurationMs ?? 0) / 1000;
                const endSec = durSec ? startSec + durSec : startSec;
                const text = (ev.segs || []).map((s: any) => s.utf8).join('');
                append(startSec, endSec, text);
            });
        }
    } catch (_jsonErr) {
        // Fallback to XML caption format
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(captionsRaw, 'text/xml');
            const texts = Array.from(xmlDoc.getElementsByTagName('text')) as any[];
            texts.forEach((node) => {
                const start = parseFloat(node.getAttribute('start') || '0');
                const dur = parseFloat(node.getAttribute('dur') || '0');
                const end = start + dur;
                const text = node.textContent || '';
                append(start, end, text);
            });
        } catch (xmlErr) {
            console.error('[captionsToXML] Failed to parse captions as JSON or XML', xmlErr);
        }
    }

    return `<captions>\n${xmlLines.join('\n')}\n</captions>`;
}