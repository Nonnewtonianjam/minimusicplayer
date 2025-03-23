/** Message from Devvit to the web view. */
export type DevvitMessage = {
  type: 'initialData';
  data: {
    notes: Note[][] | null;
    tempo: number;
  };
};

/** Message from the web view to Devvit. */
export type WebViewMessage = {
  type: 'webViewReady' | 'createNewPost';
  data?: {
    notes?: Note[][];
    tempo?: number;
  };
};

/**
 * Web view MessageEvent listener data type. The Devvit API wraps all messages
 * from Blocks to the web view.
 */
export type DevvitSystemMessage = {
  data: { message: DevvitMessage };
  /** Reserved type for messages sent via `context.ui.webView.postMessage`. */
  type?: 'devvit-message' | string;
};

export type Note = string | null;
