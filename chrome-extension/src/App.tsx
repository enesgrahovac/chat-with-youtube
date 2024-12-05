import React, { useState, useEffect } from 'react';
import styles from './App.module.css';
import './globals.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [intentions, setIntentions] = useState('');

  useEffect(() => {
    function handleMessage(request: any, sender: any, sendResponse: any) {
      
      // Check for the specific message
      if (request.isAuthenticated !== undefined) {
        setIsAuthenticated(request.isAuthenticated);
      }
    }

    // Add message listener when the component mounts
    chrome.runtime.onMessage.addListener(handleMessage);

    // Return a cleanup function to remove the listener when the component unmounts
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const handleSubmit = (event: any) => {
    event.preventDefault();
      };

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <h1>Welcome to FocusedFlow!</h1>
        <button onClick={() => window.open('https://getmolla.com/login', '_blank')}>
          Log In
        </button>
        <button onClick={() => window.open('https://getmolla.com/register', '_blank')}>
          Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>YouTube Daily Goals</h1>
      <form onSubmit={handleSubmit}>
        <label>
          What are your YouTube intentions for today?
          <input
            type="text"
            value={intentions}
            onChange={(e) => setIntentions(e.target.value)}
          />
        </label>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default App;
