# Notification sounds

`ako_message.wav` (chat messages) and `ako_activity.wav` (follows, comments, gifts, ...) are short
synthesised chimes so the custom-sound plumbing is real end to end. **To use your own sounds, replace
these two files keeping the same names** — nothing else needs to change.

Requirements (they're bundled by `expo-notifications`, see `app.config.ts`):
- **Names: lowercase letters, digits and underscores only.** Android turns the file name into a raw
  resource id, and it is also the value the push functions send.
- **Format: WAV (16-bit PCM), AIFF or CAF, under 30 seconds** (iOS limit). Aim for under 2 seconds.
- Keep the loudness moderate (peak around -6 dBFS); the OS won't normalise it for you.

Android sound belongs to the *channel*, and a channel's sound can't be changed once it exists on a
device. If you ever ship different sounds, give the channel a new id (`lib/notification-channels.ts`)
rather than editing the old one, or existing installs keep hearing the old sound.
