# System Audio Capture Guide

Pulse is now configured to capture **system audio** (what's playing through your speakers/headphones) instead of your microphone input.

## How It Works

When you start the app and login, Pulse will automatically request permission to capture your system audio. This allows it to transcribe:

- 🎤 Audio from online meetings (Zoom, Teams, Google Meet, etc.)
- 🎵 Audio from videos playing on your computer
- 🔊 Any sound output from your system
- 🎧 Audio playing through your headphones/speakers

## Setup Instructions

### 1. Grant Permission

When you first start voice recognition, Windows will show a dialog asking:

**"Pulse wants to share your screen"**

This is normal - system audio capture requires screen sharing permission.

### 2. Select What to Share

In the dialog:

1. ✅ Choose **"Entire screen"** or the specific window with audio
2. ✅ **IMPORTANT:** Check the **"Share audio"** checkbox at the bottom
3. ✅ Click **"Share"**

![Share dialog example](https://i.imgur.com/example.png)

### 3. Verify It's Working

Once granted:
- You'll see "✅ System audio capture enabled" in the console
- The transcription display will show system audio being recognized
- Any audio playing through your system will be transcribed in real-time

## Important Notes

### ✅ What Gets Captured
- Audio from meetings/calls
- Audio from videos/streams
- System sounds and notifications
- Music/media playing on your computer

### ❌ What Does NOT Get Captured
- Your microphone input (unless you explicitly enable it)
- Other people's microphones in a meeting
- External audio sources not playing through your system

### 🔒 Privacy
- **You control what's shared** - Windows asks for permission each time
- **Stop anytime** - Close Pulse or stop the voice recognition
- **Local processing** - Audio is sent only to Azure Speech Services (configured in your .env)
- **No recording** - Audio is processed in real-time, not saved to disk

## Troubleshooting

### "No audio track found"

**Cause:** You didn't check "Share audio" in the permission dialog

**Fix:**
1. Stop voice recognition (if running)
2. Start voice recognition again
3. When the dialog appears, make sure to check **"Share audio"**

### "Permission denied"

**Cause:** You clicked "Cancel" or denied permission

**Fix:**
1. Restart the app
2. Grant permission when prompted
3. Make sure to select screen/window AND check "Share audio"

### System audio not being transcribed

**Cause:** No audio is actually playing, or volume is too low

**Fix:**
1. Make sure audio is actually playing (test with a video/music)
2. Increase system volume
3. Check that the correct output device is selected in Windows Sound settings
4. Verify in console: should see "✅ System audio capture enabled"

### Microphone audio being captured instead

**Cause:** The app fell back to microphone after system audio failed

**Fix:**
1. Check console logs for errors
2. Make sure you granted screen sharing permission
3. Verify "Share audio" was checked in the dialog
4. Restart the app and try again

### Audio is choppy or delayed

**Cause:** System performance or network latency

**Fix:**
1. Close unnecessary applications
2. Check your internet connection (Azure Speech Services requires network)
3. Reduce other system load

## Technical Details

### How System Audio Capture Works

1. **getDisplayMedia API**: Requests screen + audio sharing permission
2. **Web Audio API**: Processes the audio stream
   - Converts stereo to mono
   - Resamples to 16kHz (Azure Speech SDK requirement)
   - Converts Float32 to Int16 PCM format
3. **Azure Speech SDK**: Receives processed audio via push stream
4. **Real-time Transcription**: Displays results as they come in

### Audio Pipeline

```
System Audio Output
    ↓
getDisplayMedia (Permission)
    ↓
MediaStream (Audio Track)
    ↓
Web Audio API (Processing)
    ↓
AudioContext (16kHz resampling)
    ↓
ScriptProcessor (Format conversion)
    ↓
Push Stream (Int16 PCM)
    ↓
Azure Speech SDK
    ↓
Transcription Display
```

### Fallback Behavior

If system audio capture fails for any reason:
- App automatically falls back to microphone input
- Console shows warning: "⚠️ Falling back to microphone input"
- You'll still get transcription, just from microphone instead

## Comparison: System Audio vs Microphone

| Feature | System Audio | Microphone |
|---------|--------------|------------|
| Captures meeting audio | ✅ Yes | ❌ No |
| Captures your voice | ❌ No | ✅ Yes |
| Requires permission | ✅ Screen sharing | ⚠️ Microphone access |
| Works with headphones | ✅ Yes | ✅ Yes |
| Privacy concerns | ⚠️ Captures all system audio | ⚠️ Captures your voice |
| Best for | Meeting transcription | Voice commands |

## Advanced Configuration

### Changing Audio Format

Edit `src/utils/renderer.js` if you need different audio settings:

```javascript
// Current settings (optimized for Azure Speech SDK)
const format = sdk.AudioStreamFormat.getWaveFormatPCM(
    16000,  // Sample rate (Hz)
    16,     // Bits per sample
    1       // Channels (mono)
);
```

### Adjusting Buffer Size

```javascript
// Larger buffer = less CPU usage, more latency
// Smaller buffer = more CPU usage, less latency
const processor = audioContext.createScriptProcessor(
    4096,  // Buffer size (samples)
    2,     // Input channels
    1      // Output channels
);
```

## Support

If you encounter issues:
1. Check the console for error messages (`Ctrl+Shift+I` to open DevTools)
2. Look for messages starting with 🔊, ✅, or ❌
3. Verify Azure Speech credentials are correct in `.env`
4. Ensure internet connection is stable

## Future Enhancements

Planned improvements:
- Toggle between system audio and microphone
- Visual indicator showing audio levels
- Automatic retry on permission denial
- Support for multiple audio sources simultaneously
