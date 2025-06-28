import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import './globals.css';

interface ApiKeyStatus {
    isSet: boolean;
    isValid: boolean | null;
    lastTested: Date | null;
}

function App() {
    console.log('App component is rendering');

    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState<ApiKeyStatus>({ isSet: false, isValid: null, lastTested: null });
    const [isLoading, setIsLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Load existing API key status on mount
        chrome.storage.local.get(['openai_api_key', 'api_key_status'], (result) => {
            if (result.openai_api_key) {
                setStatus({
                    isSet: true,
                    isValid: result.api_key_status?.isValid || null,
                    lastTested: result.api_key_status?.lastTested ? new Date(result.api_key_status.lastTested) : null
                });
            }
        });
    }, []);

    const validateApiKey = (key: string): boolean => {
        // Accept any string that begins with "sk-" (to support new formats like "sk-proj-...")
        return key.startsWith('sk-');
    };

    const testApiKey = async (key: string): Promise<boolean> => {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    };

    const handleSaveKey = async () => {
        if (!apiKey.trim()) {
            setMessage('Please enter an API key');
            return;
        }

        if (!validateApiKey(apiKey)) {
            setMessage('Invalid API key format. It should start with "sk-".');
            return;
        }

        setIsLoading(true);
        setMessage('Testing API key...');

        try {
            const isValid = await testApiKey(apiKey);
            const newStatus = {
                isSet: true,
                isValid,
                lastTested: new Date()
            };

            if (isValid) {
                // Store the API key securely
                chrome.storage.local.set({
                    openai_api_key: apiKey,
                    api_key_status: {
                        isValid: true,
                        lastTested: newStatus.lastTested.toISOString()
                    }
                }, () => {
                    setStatus(newStatus);
                    setMessage('API key saved successfully!');
                    setApiKey(''); // Clear input for security
                    setTimeout(() => setMessage(''), 3000);
                });
            } else {
                setMessage('API key is invalid. Please check your key and try again.');
                chrome.storage.local.set({
                    api_key_status: {
                        isValid: false,
                        lastTested: newStatus.lastTested.toISOString()
                    }
                });
                setStatus(prev => ({ ...prev, isValid: false, lastTested: newStatus.lastTested }));
            }
        } catch (error) {
            setMessage('Failed to test API key. Please check your internet connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveKey = () => {
        chrome.storage.local.remove(['openai_api_key', 'api_key_status'], () => {
            setStatus({ isSet: false, isValid: null, lastTested: null });
            setMessage('API key removed successfully');
            setTimeout(() => setMessage(''), 3000);
        });
    };

    const getStatusIcon = () => {
        if (status.isValid === true) {
            return <span style={{ color: '#059669', fontSize: '16px' }}>✓</span>;
        } else if (status.isValid === false) {
            return <span style={{ color: '#dc2626', fontSize: '16px' }}>⚠</span>;
        }
        return null;
    };

    const getStatusText = () => {
        if (!status.isSet) return 'No API key configured';
        if (status.isValid === true) return 'API key is valid';
        if (status.isValid === false) return 'API key is invalid';
        return 'API key not tested';
    };

    return (
        <div
            style={{
                width: 360,
                height: 400,
                padding: 16,
                fontFamily: 'Arial, sans-serif',
                backgroundColor: '#fff',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
            }}
        >
            <h2 style={{ margin: '0 0 8px 0', fontSize: 18 }}>YouTube Chat – Settings</h2>

            {/* Status Row */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                {getStatusIcon()}
                <span style={{ marginLeft: 6, fontSize: 14 }}>{getStatusText()}</span>
            </div>

            {/* Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your OpenAI API key (sk-...)"
                    style={{
                        padding: 10,
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontSize: 14
                    }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        onClick={() => setShowKey((prev) => !prev)}
                        style={{
                            padding: '6px 12px',
                            fontSize: 13,
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            background: '#f9f9f9',
                            cursor: 'pointer'
                        }}
                    >
                        {showKey ? 'Hide' : 'Show'}
                    </button>
                    <button
                        onClick={handleSaveKey}
                        disabled={isLoading}
                        style={{
                            padding: '6px 16px',
                            fontSize: 13,
                            border: 'none',
                            borderRadius: 4,
                            background: '#007cba',
                            color: '#fff',
                            cursor: isLoading ? 'default' : 'pointer',
                            opacity: isLoading ? 0.6 : 1
                        }}
                    >
                        {isLoading ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        onClick={handleRemoveKey}
                        disabled={!status.isSet}
                        style={{
                            padding: '6px 12px',
                            fontSize: 13,
                            border: '1px solid #dc2626',
                            borderRadius: 4,
                            background: '#fff',
                            color: '#dc2626',
                            cursor: status.isSet ? 'pointer' : 'default',
                            opacity: status.isSet ? 1 : 0.5
                        }}
                    >
                        Remove
                    </button>
                </div>

                {/* External link to create/retrieve key */}
                <div style={{ marginTop: 16 }}>
                    <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: '#007cba',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 14,
                            fontWeight: 500
                        }}
                    >
                        <span>Get an API key</span>
                        <ExternalLink size={14} strokeWidth={2} />
                    </a>
                </div>
            </div>

            {/* Message / feedback area */}
            {message && (
                <div
                    style={{
                        marginTop: 14,
                        padding: 10,
                        background: '#e6f3ff',
                        borderRadius: 4,
                        fontSize: 13,
                        lineHeight: 1.3
                    }}
                >
                    {message}
                </div>
            )}
        </div>
    );
}

export default App;
