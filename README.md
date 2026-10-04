# 🎬 Copyright.js AI — Complete Tutorial

This version uses **AI vision** to inspect video frames and identify recognizable characters.

## 1. Create the project

Open Terminal, PowerShell, or Termux:

```bash
mkdir CopyrightJS
cd CopyrightJS
```

Initialize Node:

```bash
npm init -y
```

Install the OpenAI SDK:

```bash
npm install openai
```

Your project will look like:

```text
CopyrightJS/
├── package.json
├── package-lock.json
└── node_modules/
```

---

## 2. Create `Copyright.js`

Create the file:

```bash
touch Copyright.js
```

On Windows PowerShell:

```powershell
New-Item Copyright.js
```

Open it in your editor and paste the **full AI version of `Copyright.js`** from the previous message.

Your project should now be:

```text
CopyrightJS/
├── Copyright.js
├── package.json
├── package-lock.json
└── node_modules/
```

---

# 3. Install FFmpeg

Copyright.js needs FFmpeg to extract frames from the video.

### Windows

Install FFmpeg and verify:

```bash
ffmpeg -version
```

You should see:

```text
ffmpeg version ...
```

### Termux

Run:

```bash
pkg update
pkg install ffmpeg
```

Then:

```bash
ffmpeg -version
```

---

# 4. Set your OpenAI API key

You need an OpenAI API key for the AI scanner.

**Do not put the API key directly inside `Copyright.js`.**

### Windows PowerShell

```powershell
$env:OPENAI_API_KEY="YOUR_API_KEY"
```

### Windows CMD

```cmd
set OPENAI_API_KEY=YOUR_API_KEY
```

### Linux/macOS/Termux

```bash
export OPENAI_API_KEY="YOUR_API_KEY"
```

Verify that Node can see it:

```bash
node -e "console.log(process.env.OPENAI_API_KEY ? 'API key detected' : 'API key missing')"
```

You should get:

```text
API key detected
```

---

# 5. Initialize Copyright.js

Run:

```bash
node Copyright.js init
```

You should see:

```text
Copyright.js initialized.
Database: .../.copyrightjs
Model:    gpt-5.5
```

It creates:

```text
CopyrightJS/
├── Copyright.js
├── package.json
├── package-lock.json
├── node_modules/
└── .copyrightjs/
    ├── config.json
    └── characters.json
```

---

# 6. Add characters

You can tell Copyright.js about characters you want it to pay particular attention to.

For example:

```bash
node Copyright.js character Mario
```

Then:

```bash
node Copyright.js character Sonic
```

And:

```bash
node Copyright.js character Pikachu
```

You can add as many as you want:

```bash
node Copyright.js character "SpongeBob SquarePants"
node Copyright.js character "Mickey Mouse"
node Copyright.js character "Tom"
node Copyright.js character "Jerry"
```

The database becomes:

```text
.characters.json
```

containing something like:

```json
[
  "Mario",
  "Sonic",
  "Pikachu",
  "SpongeBob SquarePants",
  "Mickey Mouse",
  "Tom",
  "Jerry"
]
```

These aren't the only characters the AI can potentially recognize—the list is provided as additional context.

---

# 7. Put your video in the project

For example:

```text
CopyrightJS/
├── Copyright.js
├── video.mp4
├── package.json
├── node_modules/
└── .copyrightjs/
```

You can also use a different location:

```bash
node Copyright.js scan "C:\Videos\myvideo.mp4"
```

---

# 8. Run your first AI scan

Run:

```bash
node Copyright.js scan video.mp4
```

Copyright.js does this:

```text
             video.mp4
                 │
                 ▼
             FFmpeg
                 │
                 ▼
          Extract video frame
                 │
                 ▼
          Send frame to AI
                 │
                 ▼
       AI visual recognition
                 │
                 ▼
       Character identification
                 │
                 ▼
        Confidence filtering
                 │
                 ▼
             Report
```

---

# 9. Example output

You might see:

```text
==========================================
Copyright.js AI Video Scanner v2.0.0
==========================================
Model:       gpt-5.5
Video:       C:\CopyrightJS\video.mp4
Interval:    2s
Threshold:   70%

Duration:    00:00:20.000
FPS:         30

Known characters:
  Mario, Sonic, Pikachu

Analyzing frame 10/10 — 90%

==========================================
AI SCAN COMPLETE
==========================================

Possible character appearances: 2

[00:04.000 - 00:08.000]
  Character:   Mario
  Franchise:   Super Mario
  Confidence:  94%
  Samples:     3
  Evidence:    Red cap, blue overalls, recognizable facial
               features and character design.

[00:14.000 - 00:16.000]
  Character:   Sonic
  Franchise:   Sonic the Hedgehog
  Confidence:  91%
  Samples:     2
  Evidence:    Blue anthropomorphic hedgehog with distinctive
               quills and character design.

IMPORTANT:
These are AI visual-identification results,
not legal copyright or infringement decisions.
```

---

# 10. Make the scanner more accurate

The default interval is:

```text
2 seconds
```

So a 20-second video is approximately:

```text
00:00
00:02
00:04
00:06
...
00:18
```

For more frequent analysis:

```bash
node Copyright.js scan video.mp4 --interval 1
```

Now it checks approximately every second.

For even more frequent analysis:

```bash
node Copyright.js scan video.mp4 --interval 0.5
```

That's approximately:

```text
00:00.0
00:00.5
00:01.0
00:01.5
00:02.0
...
```

**Warning:** smaller intervals mean more AI requests.

---

# 11. Change the confidence threshold

Default:

```text
70%
```

You can make the detector stricter:

```bash
node Copyright.js scan video.mp4 --threshold 85
```

Now only detections with at least approximately 85% AI confidence are reported.

### Recommended values

| Threshold | Behavior            |
| --------- | ------------------- |
| `60`      | Very sensitive      |
| `70`      | Balanced            |
| `75`      | Good starting point |
| `80`      | Conservative        |
| `90`      | Very strict         |

I'd start with:

```bash
node Copyright.js scan video.mp4 --interval 1 --threshold 75
```

---

# 12. Save a JSON report

You can save the results:

```bash
node Copyright.js scan video.mp4 --json report.json
```

You can combine everything:

```bash
node Copyright.js scan video.mp4 --interval 1 --threshold 75 --json report.json
```

The project becomes:

```text
CopyrightJS/
├── Copyright.js
├── video.mp4
├── report.json
├── package.json
├── package-lock.json
├── node_modules/
└── .copyrightjs/
```

---

# 13. What's inside `report.json`?

You'll get information similar to:

```json
{
  "tool": "Copyright.js",
  "version": "2.0.0",
  "aiUsed": true,
  "provider": "OpenAI",
  "model": "gpt-5.5",
  "video": "/videos/video.mp4",
  "settings": {
    "interval": 1,
    "threshold": 75
  },
  "detections": [
    {
      "character": "Mario",
      "franchise": "Super Mario",
      "startTime": 4,
      "startTimeFormatted": "00:00:04.000",
      "endTime": 8,
      "endTimeFormatted": "00:00:08.000",
      "confidence": 94,
      "samples": 5,
      "evidence": "Distinctive Mario character design."
    }
  ]
}
```

This makes it easy to use Copyright.js from a website, dashboard, Discord bot, or another Node application.

---

# 14. Change the AI model

The model is configurable.

Linux/Termux:

```bash
export COPYRIGHT_MODEL="gpt-5.5"
```

Windows PowerShell:

```powershell
$env:COPYRIGHT_MODEL="gpt-5.5"
```

Then:

```bash
node Copyright.js scan video.mp4
```

Or set it for one command:

```bash
COPYRIGHT_MODEL="gpt-5.5" node Copyright.js scan video.mp4
```

On PowerShell:

```powershell
$env:COPYRIGHT_MODEL="gpt-5.5"; node Copyright.js scan video.mp4
```

---

# 15. Check the current configuration

Run:

```bash
node Copyright.js models
```

You'll see:

```text
Copyright.js AI model configuration
====================================
Current model: gpt-5.5

Set another model with:
  COPYRIGHT_MODEL=<model> node Copyright.js scan video.mp4
```

---

# 16. Recommended setup

For normal videos, use:

```bash
node Copyright.js scan video.mp4 --interval 1 --threshold 75 --json report.json
```

For short videos where you want detailed analysis:

```bash
node Copyright.js scan video.mp4 --interval 0.5 --threshold 70 --json report.json
```

For long videos where API usage should be minimized:

```bash
node Copyright.js scan video.mp4 --interval 5 --threshold 80 --json report.json
```

---

# 17. Important: what the AI actually detects

The scanner is looking for **recognizable visual characters**.

For example:

```text
Frame
  ↓
"Blue anthropomorphic hedgehog,
red shoes, distinctive quills"
  ↓
AI
  ↓
Sonic
  ↓
91% confidence
```

It can also report multiple characters:

```json
{
  "characters": [
    {
      "name": "Mario",
      "confidence": 94
    },
    {
      "name": "Luigi",
      "confidence": 89
    }
  ]
}
```

---

# 18. What it does NOT mean

If Copyright.js says:

```text
Mario — 94%
```

that means:

> The AI believes the frame visually contains Mario.

It **doesn't** mean:

> The video definitely infringes Nintendo's copyright.

Likewise:

```text
No characters detected
```

doesn't mean:

> This video is copyright-free.

The tool is an **AI visual detection system**, not a legal copyright adjudicator.

---

## Quick-start version

Once everything is installed, the normal workflow is just:

```bash
cd CopyrightJS
```

```bash
export OPENAI_API_KEY="YOUR_API_KEY"
```

```bash
node Copyright.js init
```

```bash
node Copyright.js character Mario
node Copyright.js character Sonic
node Copyright.js character Pikachu
```

Then:

```bash
node Copyright.js scan video.mp4 --interval 1 --threshold 75 --json report.json
```

And you'll have an AI-generated character detection report with **timestamps, characters, franchises, confidence scores, evidence, and raw frame-level results**.
