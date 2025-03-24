/** Message from Devvit to the web view. */
export type DevvitMessage =
  | {
      type: 'initialData';
      data: {
        notes?: Note[][];
        tempo?: number;
        theme?: string;
      };
    }
  | {
      type: 'updateCounter';
      data: {
        counter: number;
      };
    };

/** Message from the web view to Devvit. */
export type WebViewMessage =
  | {
      type: 'webViewReady';
    }
  | {
      type: 'setCounter';
      data: {
        newCounter: number;
      };
    }
  | {
      type: 'createNewPost';
      data: {
        notes?: Note[][];
        tempo?: number;
        username?: string;
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
