import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

import type { DevvitMessage, WebViewMessage } from './message.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Music Sequencer',
  height: 'tall',
  render: (context) => {
    // Load saved music data from redis
    const [musicData] = useState(async () => {
      const savedNotes = await context.redis.get(`notes_${context.postId}`);
      const savedTempo = await context.redis.get(`tempo_${context.postId}`);
      return {
        notes: savedNotes ? JSON.parse(savedNotes) : null,
        tempo: savedTempo ? Number(savedTempo) : 120
      };
    });

    const webView = useWebView<WebViewMessage, DevvitMessage>({
      url: 'page.html',

      async onMessage(message, webView) {
        switch (message.type) {
          case 'webViewReady':
            webView.postMessage({
              type: 'initialData',
              data: {
                notes: musicData.notes,
                tempo: musicData.tempo
              },
            });
            break;

          case 'createNewPost':
            // Create a new post with the current music data
            const subreddit = await context.reddit.getCurrentSubreddit();
            const post = await context.reddit.submitPost({
              title: `Music Sequence - Tempo: ${message.data.tempo ?? 120}`,
              subredditName: subreddit.name,
              kind: 'image',
              preview: (
                <vstack height="100%" width="100%" alignment="middle center">
                  <text size="large">Loading Music Sequencer...</text>
                </vstack>
              ),
            });

            // Save the music data to the new post
            if (message.data.notes) {
              await context.redis.set(
                `notes_${post.id}`,
                JSON.stringify(message.data.notes)
              );
            }
            if (message.data.tempo) {
              await context.redis.set(
                `tempo_${post.id}`,
                message.data.tempo.toString()
              );
            }

            context.ui.showToast('Created new music sequence!');
            context.ui.navigateTo(`https://reddit.com${post.permalink}`);
            break;

          default:
            throw new Error(`Unknown message type: ${message.type}`);
        }
      },
      onUnmount() {
        context.ui.showToast('Music sequencer closed!');
      },
    });

    return (
      <vstack grow padding="small">
        <vstack grow alignment="middle center">
          <text size="xlarge" weight="bold">
            Music Sequencer
          </text>
          <spacer />
          <vstack alignment="start middle">
            <hstack>
              <text size="medium">Tempo:</text>
              <text size="medium" weight="bold">
                {' '}
                {musicData.tempo ?? 120} BPM
              </text>
            </hstack>
            <hstack>
              <text size="medium">Notes:</text>
              <text size="medium" weight="bold">
                {' '}
                {musicData.notes ? 'Loaded' : 'Empty'}
              </text>
            </hstack>
          </vstack>
          <spacer />
          <button onPress={() => webView.mount()}>Open Sequencer</button>
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;
