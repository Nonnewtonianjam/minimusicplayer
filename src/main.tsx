import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

import type { DevvitMessage, WebViewMessage } from './message.js';

// List of possible themes
const THEMES = [
  "Space Adventure",
  "Underwater Journey",
  "Forest Mystery",
  "Desert Winds",
  "City Nights",
  "Mountain Peak",
  "Ancient Ruins",
  "Magical Garden",
  "Storm at Sea",
  "Jungle Expedition",
  "Arctic Wilderness",
  "Volcanic Island",
  "Medieval Castle",
  "Futuristic City",
  "Enchanted Cave"
];

interface Note {
  instrument: number;
  frequency: number;
}

type MusicData = {
  notes?: Note[][];
  tempo: number;
  theme?: string;
}

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Function to get today's theme
async function getDailyTheme(context: { redis: any }) {
  const today = new Date().toISOString().split('T')[0];
  let theme = await context.redis.get(`daily_theme_${today}`);
  
  if (!theme) {
    // Generate new theme for today
    const randomIndex = Math.floor(Math.random() * THEMES.length);
    theme = THEMES[randomIndex];
    // Store theme with expiration (24 hours + buffer)
    await context.redis.set(`daily_theme_${today}`, theme, { expiresIn: 26 * 60 * 60 });
  }
  
  return theme;
}

// Add a custom post type to Devvit
Devvit.addCustomPostType({
  name: 'Music Sequencer',
  height: 'tall',
  render: (context) => {
    // Load saved music data and theme from redis
    const [musicData] = useState<MusicData>({
      notes: undefined,
      tempo: 120,
      theme: undefined
    });

    useState(async () => {
      const savedNotes = await context.redis.get(`notes_${context.postId}`);
      const savedTempo = await context.redis.get(`tempo_${context.postId}`);
      const savedTheme = await context.redis.get(`theme_${context.postId}`);
      
      if (savedNotes) {
        musicData.notes = JSON.parse(savedNotes);
      }
      if (savedTempo) {
        musicData.tempo = Number(savedTempo);
      }
      if (savedTheme) {
        musicData.theme = savedTheme;
      } else {
        // If no theme is saved, get today's theme
        musicData.theme = await getDailyTheme(context);
      }
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
                tempo: musicData.tempo,
                theme: musicData.theme
              },
            });
            break;

          case 'createNewPost':
            // Get today's theme
            const theme = await getDailyTheme(context);
            
            // Create a new post with the current music data
            const subreddit = await context.reddit.getCurrentSubreddit();
            const post = await context.reddit.submitPost({
              title: `🎵 Daily Theme: "${theme}" - Tempo: ${message.data?.tempo ?? 120} BPM`,
              subredditName: subreddit.name,
              kind: 'image',
              preview: (
                <vstack height="100%" width="100%" alignment="middle center">
                  <text size="large">Loading Music Sequencer...</text>
                  <text size="medium" color="blue">Theme: "{theme}"</text>
                </vstack>
              ),
              text: `# Daily Music Theme: "${theme}" 🎵\n\nCreate your music sequence inspired by today's theme! Use the sequencer to compose a melody that captures the essence of "${theme}".\n\n## How to Participate:\n1. Click "Open Sequencer" to start creating\n2. Use the instrument buttons to select different sounds\n3. Click on the grid to place notes\n4. Adjust the tempo to match your vision\n5. Click "Save & Create New Post" when you're done\n\nHappy composing! 🎼`,
            });

            // Save the music data and theme to the new post
            if (message.data?.notes) {
              await context.redis.set(
                `notes_${post.id}`,
                JSON.stringify(message.data.notes)
              );
            }
            if (message.data?.tempo) {
              await context.redis.set(
                `tempo_${post.id}`,
                message.data.tempo.toString()
              );
            }
            await context.redis.set(`theme_${post.id}`, theme);

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
          {musicData.theme && (
            <text size="large" color="blue">
              Today's Theme: "{musicData.theme}"
            </text>
          )}
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
