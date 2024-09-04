// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Constants
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds
const ENDPOINT = 'http://crackboard.dev/heartbeat';

// Variables
let lastHeartbeatTime: number | undefined;
let typingTimer: NodeJS.Timeout | undefined;
let sessionKey: string | undefined;

const sendHeartbeat = async (language: string) => {
    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                "session_key": sessionKey,
                "language_name": language
            })
        });

        if (response.ok) {
            lastHeartbeatTime = Date.now();
            console.log('Heartbeat sent successfully.');
        } else {
            console.error('Failed to send heartbeat:', response.statusText);
        }
    } catch (error) {
        console.error('Failed to send heartbeat:', error);
    }
};

// Send heartbeat on file save
const onDidSaveTextDocument = (document: vscode.TextDocument) => {
    const language = document.languageId;
    sendHeartbeat(language);
};

// Set up typing tracker
const onDidChangeTextDocument = (event: vscode.TextDocumentChangeEvent) => {
    if (typingTimer) {
        clearTimeout(typingTimer);
    }

    typingTimer = setTimeout(() => {
        const now = Date.now();
        const language = event.document.languageId;
        if (!lastHeartbeatTime || (now - lastHeartbeatTime) >= HEARTBEAT_INTERVAL) {
            sendHeartbeat(language);
        }
    }, HEARTBEAT_INTERVAL);
};

// Show an input box to enter the session key
const inputSessionKey = async () => {
    const result = await vscode.window.showInputBox({
        prompt: 'Enter session key:',
        placeHolder: 'Session key'
    });

    if (result !== undefined) {
        sessionKey = result;
        try {
            await vscode.workspace.getConfiguration().update('crackboard.sessionKey', sessionKey, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Session key set to: ${sessionKey}`);
            console.log(`Session key updated successfully: ${sessionKey}`);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to save session key.');
            console.error('Failed to save session key:', error);
        }
    }
};

// Load the session key from configuration
const loadSessionKey = () => {
    const config = vscode.workspace.getConfiguration();
    sessionKey = config.get<string>('crackboard.sessionKey');
    console.log(`Loaded session key: ${sessionKey}`);
};

export function activate(context: vscode.ExtensionContext) {
    // Load the session key
    loadSessionKey();

    // Register the session key command
    const disposableSessionKeyCommand = vscode.commands.registerCommand('crackboard.inputSessionKey', async () => {
        await inputSessionKey();
    });

    // Subscribe to save event
    const disposableSave = vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument);

    // Subscribe to text change event
    const disposableChange = vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument);

    context.subscriptions.push(disposableSessionKeyCommand, disposableSave, disposableChange);
}

export function deactivate() {
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
}
