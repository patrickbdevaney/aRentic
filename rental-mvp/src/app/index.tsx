import { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
        redirectUri: '/auth/callback',
    },
};

const msalInstance = new PublicClientApplication(msalConfig);

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [chat, setChat] = useState<string[]>([]);
    const [emailDraft, setEmailDraft] = useState('');
    const [calendarTime, setCalendarTime] = useState('');
    const [listing, setListing] = useState<any>(null);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const token = hashParams.get('access_token');
        if (token) {
            setAuthenticated(true);
            setChat([...chat, 'User authenticated with Microsoft.']);
        }
    }, []);

    const handleLogin = async () => {
        const loginRequest = {
            scopes: ['Mail.Send', 'Calendars.ReadWrite'],
        };
        await msalInstance.loginPopup(loginRequest);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authenticated) {
            handleLogin();
            return;
        }
        setChat([...chat, `User: ${prompt}`]);
        const response = await fetch('/api/submit_prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        const data = await response.json();
        if (data.error) {
            setChat([...chat, `Error: ${data.error}`]);
            return;
        }
        setChat([...chat, 'ElizaOS: Searching RentCast API...']);
        setListing(data.listing);
        setEmailDraft(data.email_draft);
        setCalendarTime(data.calendar_time.split('.')[0].replace('Z', ''));
        setChat([...chat, 'ElizaOS: Email draft generated.', 'ElizaOS: Calendar invite prepared.']);
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = (await msalInstance.acquireTokenSilent({ scopes: ['Mail.Send', 'Calendars.ReadWrite'] })).accessToken;
        const response = await fetch('/api/confirm_hitl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_draft: emailDraft, calendar_time: `${calendarTime}Z`, listing, token }),
        });
        const data = await response.json();
        setChat([...chat, 'ElizaOS: Email sent and calendar event created!']);
    };

    return (
        <div className="container mt-5">
            <h1 className="text-center mb-4">Rental Chatbot</h1>
            <div className="card p-3 mb-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {chat.map((msg, i) => (
                    <p key={i} className="mb-1">{msg}</p>
                ))}
            </div>
            {!authenticated && (
                <button className="btn btn-primary mb-3" onClick={handleLogin}>
                    Authenticate with Microsoft
                </button>
            )}
            <form onSubmit={handleSubmit} className="mb-3">
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Find a studio rental in New York, NY under $2000/month"
                        disabled={!authenticated}
                    />
                    <button type="submit" className="btn btn-primary" disabled={!authenticated}>
                        Send
                    </button>
                </div>
            </form>
            {emailDraft && (
                <form onSubmit={handleConfirm}>
                    <div className="card p-3 mb-3">
                        <h5>Email Draft</h5>
                        <textarea
                            className="form-control mb-2"
                            value={emailDraft}
                            onChange={(e) => setEmailDraft(e.target.value)}
                        />
                        <h5>Calendar Time</h5>
                        <input
                            type="datetime-local"
                            className="form-control mb-2"
                            value={calendarTime}
                            onChange={(e) => setCalendarTime(e.target.value)}
                        />
                        <button type="submit" className="btn btn-success">Confirm</button>
                    </div>
                </form>
            )}
        </div>
    );
}