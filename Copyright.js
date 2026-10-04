#!/usr/bin/env node

"use strict";

/*
 * Copyright.js
 * =========================================================
 * AI-powered video character detector
 *
 * Uses:
 *   - FFmpeg       -> video/frame extraction
 *   - OpenAI API   -> visual character identification
 *
 * IMPORTANT:
 * This tool does NOT legally determine copyright infringement.
 * It identifies characters or visual properties that an AI model
 * believes are present in sampled video frames.
 *
 * Environment variables:
 *
 *   OPENAI_API_KEY
 *       Required.
 *
 *   COPYRIGHT_MODEL
 *       Optional.
 *       Default: gpt-5.5
 *
 *   COPYRIGHT_INTERVAL
 *       Optional.
 *       Default: 2 seconds
 *
 *   COPYRIGHT_THRESHOLD
 *       Optional.
 *       Default: 70
 *
 * Commands:
 *
 *   node Copyright.js init
 *   node Copyright.js models
 *   node Copyright.js scan video.mp4
 *   node Copyright.js scan video.mp4 --interval 1
 *   node Copyright.js scan video.mp4 --threshold 80
 *   node Copyright.js scan video.mp4 --json report.json
 *
 * =========================================================
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");

let OpenAI;

try {
    OpenAI = require("openai");
} catch {
    console.error(
        "\nERROR: The 'openai' package is not installed.\n\n" +
        "Run:\n" +
        "  npm install openai\n"
    );

    process.exit(1);
}


// =========================================================
// Configuration
// =========================================================

const APP_NAME = "Copyright.js";
const VERSION = "2.0.0";

const DEFAULT_MODEL =
    process.env.COPYRIGHT_MODEL ||
    "gpt-5.5";

const DEFAULT_INTERVAL =
    Number(
        process.env.COPYRIGHT_INTERVAL ||
        2
    );

const DEFAULT_THRESHOLD =
    Number(
        process.env.COPYRIGHT_THRESHOLD ||
        70
    );

const DATABASE_DIR =
    path.join(
        process.cwd(),
        ".copyrightjs"
    );

const CONFIG_FILE =
    path.join(
        DATABASE_DIR,
        "config.json"
    );


// =========================================================
// Utilities
// =========================================================

function ensureDatabase() {
    fs.mkdirSync(
        DATABASE_DIR,
        {
            recursive: true
        }
    );
}

function checkApiKey() {
    if (
        !process.env.OPENAI_API_KEY ||
        !process.env.OPENAI_API_KEY.trim()
    ) {
        console.error(
            "\nERROR: OPENAI_API_KEY is not set.\n"
        );

        console.error(
            "Windows PowerShell:"
        );

        console.error(
            '  $env:OPENAI_API_KEY="YOUR_API_KEY"'
        );

        console.error(
            "\nLinux/macOS/Termux:"
        );

        console.error(
            '  export OPENAI_API_KEY="YOUR_API_KEY"\n'
        );

        process.exit(1);
    }
}

function commandExists(command) {
    const result =
        spawnSync(
            command,
            ["-version"],
            {
                stdio: "ignore",
                shell:
                    process.platform ===
                    "win32"
            }
        );

    return result.status === 0;
}

function checkFFmpeg() {
    if (!commandExists("ffmpeg")) {
        console.error(
            "\nERROR: FFmpeg is not installed or is not in PATH.\n"
        );

        console.error(
            "Test with:"
        );

        console.error(
            "  ffmpeg -version\n"
        );

        process.exit(1);
    }
}

function fileExists(file) {
    try {
        return (
            fs.existsSync(file) &&
            fs.statSync(file).isFile()
        );
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

function formatTime(seconds) {
    seconds =
        Number(seconds) || 0;

    const hours =
        Math.floor(
            seconds / 3600
        );

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        Math.floor(seconds % 60);

    const millis =
        Math.floor(
            (seconds -
                Math.floor(seconds)) *
            1000
        );

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0") +
        "." +
        String(millis).padStart(3, "0")
    );
}

function parseArguments(args) {
    const result = {
        command: null,
        positional: [],
        options: {}
    };

    for (
        let i = 0;
        i < args.length;
        i++
    ) {
        const arg = args[i];

        if (
            arg.startsWith("--")
        ) {
            const option =
                arg.slice(2);

            if (
                option.includes("=")
            ) {
                const parts =
                    option.split("=");

                const key =
                    parts.shift();

                result.options[key] =
                    parts.join("=");

                continue;
            }

            const next =
                args[i + 1];

            if (
                next &&
                !next.startsWith("--")
            ) {
                result.options[
                    option
                ] = next;

                i++;
            } else {
                result.options[
                    option
                ] = true;
            }
        } else {
            result.positional.push(arg);
        }
    }

    result.command =
        result.positional.shift() ||
        null;

    return result;
}


// =========================================================
// FFmpeg
// =========================================================

function runProcess(
    command,
    args
) {
    return new Promise(
        (resolve, reject) => {
            const child =
                spawn(
                    command,
                    args,
                    {
                        stdio: [
                            "ignore",
                            "pipe",
                            "pipe"
                        ],
                        shell:
                            process.platform ===
                            "win32"
                    }
                );

            let stdout = "";
            let stderr = "";

            child.stdout.on(
                "data",
                data => {
                    stdout +=
                        data.toString();
                }
            );

            child.stderr.on(
                "data",
                data => {
                    stderr +=
                        data.toString();
                }
            );

            child.on(
                "error",
                reject
            );

            child.on(
                "close",
                code => {
                    if (code !== 0) {
                        reject(
                            new Error(
                                `${command} exited with code ${code}\n${stderr}`
                            )
                        );

                        return;
                    }

                    resolve({
                        stdout,
                        stderr
                    });
                }
            );
        }
    );
}

async function getVideoInfo(video) {
    try {
        const result =
            await runProcess(
                "ffmpeg",
                [
                    "-i",
                    video
                ]
            );

        return parseVideoInfo(
            result.stderr
        );
    } catch (error) {
        /*
         * FFmpeg normally exits with code 1 when only
         * inspecting a media file. The useful metadata is
         * nevertheless present in stderr.
         */

        const stderr =
            error?.message || "";

        return parseVideoInfo(
            stderr
        );
    }
}

function parseVideoInfo(text) {
    const durationMatch =
        text.match(
            /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i
        );

    const fpsMatch =
        text.match(
            /(\d+(?:\.\d+)?)\s*(?:fps|tbr)/i
        );

    let duration = 0;

    if (durationMatch) {
        duration =
            Number(
                durationMatch[1]
            ) *
            3600 +
            Number(
                durationMatch[2]
            ) *
            60 +
            Number(
                durationMatch[3]
            );
    }

    return {
        duration,
        fps:
            fpsMatch
                ? Number(
                      fpsMatch[1]
                  )
                : null
    };
}

async function extractFrame(
    video,
    timestamp,
    output
) {
    await runProcess(
        "ffmpeg",
        [
            "-y",

            "-ss",
            String(timestamp),

            "-i",
            video,

            "-frames:v",
            "1",

            /*
             * Resize frames before sending them to the
             * vision model. This reduces request size.
             */
            "-vf",
            "scale=1280:-2",

            "-q:v",
            "4",

            output
        ]
    );
}


// =========================================================
// Image → Data URL
// =========================================================

function imageToDataURL(
    imagePath
) {
    const buffer =
        fs.readFileSync(
            imagePath
        );

    const base64 =
        buffer.toString(
            "base64"
        );

    return (
        "data:image/jpeg;base64," +
        base64
    );
}


// =========================================================
// AI detector
// =========================================================

function createOpenAIClient() {
    checkApiKey();

    return new OpenAI({
        apiKey:
            process.env
                .OPENAI_API_KEY,

        /*
         * Avoid hanging forever on a bad
         * network connection.
         */
        timeout: 120000,

        maxRetries: 2
    });
}

function buildDetectionPrompt(
    knownCharacters
) {
    const characterList =
        knownCharacters.length
            ? knownCharacters.join(
                  ", "
              )
            : "none";

    return `
You are the visual-analysis engine for Copyright.js.

Analyze the supplied video frame.

Your task is to identify recognizable fictional,
branded, copyrighted, trademarked, or otherwise
distinctive characters visible in the image.

KNOWN CHARACTER DATABASE:
${characterList}

IMPORTANT RULES:

1. Only report a character if there is visual evidence.
2. Do not invent characters.
3. If the character is uncertain, use a lower confidence.
4. Distinguish real people from fictional characters.
5. A generic cat, dog, person, robot, etc. is NOT automatically
   a copyrighted character.
6. If you recognize a specific character, provide the likely
   character name and franchise.
7. Multiple characters may appear.
8. Return ONLY valid JSON.
9. Do not use Markdown.
10. Confidence must be from 0 to 100.

Return exactly:

{
  "characters": [
    {
      "name": "Character name",
      "franchise": "Franchise name",
      "confidence": 0,
      "evidence": "Short visual explanation",
      "knownReferenceMatch": true
    }
  ],
  "sceneDescription": "Short description",
  "containsRecognizableCharacter": false
}

If there are no recognizable characters:

{
  "characters": [],
  "sceneDescription": "Description",
  "containsRecognizableCharacter": false
}
`;
}

function extractJSON(text) {
    if (!text) {
        throw new Error(
            "The AI returned an empty response."
        );
    }

    let cleaned =
        text.trim();

    /*
     * Remove accidental Markdown fences.
     */

    cleaned =
        cleaned
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();

    try {
        return JSON.parse(
            cleaned
        );
    } catch {
        /*
         * Try to find the JSON object if the model
         * included a little extra text.
         */

        const first =
            cleaned.indexOf("{");

        const last =
            cleaned.lastIndexOf("}");

        if (
            first !== -1 &&
            last !== -1 &&
            last > first
        ) {
            return JSON.parse(
                cleaned.slice(
                    first,
                    last + 1
                )
            );
        }

        throw new Error(
            "AI returned invalid JSON:\n" +
            text
        );
    }
}

function normalizeAIResult(
    result
) {
    if (
        !result ||
        typeof result !==
            "object"
    ) {
        return {
            characters: [],
            sceneDescription: "",
            containsRecognizableCharacter:
                false
        };
    }

    const characters =
        Array.isArray(
            result.characters
        )
            ? result.characters
            : [];

    return {
        characters:
            characters
                .filter(
                    character =>
                        character &&
                        typeof character ===
                            "object"
                )
                .map(
                    character => ({
                        name:
                            String(
                                character.name ||
                                    "Unknown"
                            ),

                        franchise:
                            String(
                                character.franchise ||
                                    "Unknown"
                            ),

                        confidence:
                            Math.max(
                                0,
                                Math.min(
                                    100,
                                    Number(
                                        character.confidence
                                    ) || 0
                                )
                            ),

                        evidence:
                            String(
                                character.evidence ||
                                    ""
                            ),

                        knownReferenceMatch:
                            Boolean(
                                character.knownReferenceMatch
                            )
                    })
                ),

        sceneDescription:
            String(
                result.sceneDescription ||
                    ""
            ),

        containsRecognizableCharacter:
            Boolean(
                result.containsRecognizableCharacter
            )
    };
}

async function analyzeFrame(
    client,
    framePath,
    knownCharacters
) {
    const imageURL =
        imageToDataURL(
            framePath
        );

    const response =
        await client.responses.create(
            {
                model:
                    DEFAULT_MODEL,

                instructions:
                    "You are a precise video-frame visual analysis system. Follow the requested JSON format exactly.",

                input: [
                    {
                        role: "user",

                        content: [
                            {
                                type:
                                    "input_text",

                                text:
                                    buildDetectionPrompt(
                                        knownCharacters
                                    )
                            },

                            {
                                type:
                                    "input_image",

                                image_url:
                                    imageURL,

                                detail:
                                    "auto"
                            }
                        ]
                    }
                ]
            }
        );

    return normalizeAIResult(
        extractJSON(
            response.output_text
        )
    );
}


// =========================================================
// Detection grouping
// =========================================================

function addDetection(
    detections,
    timestamp,
    character
) {
    const existing =
        detections.find(
            detection =>
                detection.name
                    .toLowerCase() ===
                character.name
                    .toLowerCase() &&
                Math.abs(
                    detection.lastTimestamp -
                        timestamp
                ) <= 4
        );

    if (existing) {
        existing.lastTimestamp =
            timestamp;

        existing.endTime =
            timestamp;

        existing.maxConfidence =
            Math.max(
                existing.maxConfidence,
                character.confidence
            );

        existing.samples++;

        return;
    }

    detections.push({
        name:
            character.name,

        franchise:
            character.franchise,

        startTime:
            timestamp,

        endTime:
            timestamp,

        lastTimestamp:
            timestamp,

        maxConfidence:
            character.confidence,

        samples:
            1,

        evidence:
            character.evidence
    });
}

function finalizeDetections(
    detections
) {
    return detections.map(
        detection => ({
            character:
                detection.name,

            franchise:
                detection.franchise,

            startTime:
                detection.startTime,

            startTimeFormatted:
                formatTime(
                    detection.startTime
                ),

            endTime:
                detection.endTime,

            endTimeFormatted:
                formatTime(
                    detection.endTime
                ),

            confidence:
                detection.maxConfidence,

            samples:
                detection.samples,

            evidence:
                detection.evidence
        })
    );
}


// =========================================================
// Scan
// =========================================================

async function scanVideo(
    video,
    options
) {
    checkApiKey();
    checkFFmpeg();

    if (
        !fileExists(video)
    ) {
        throw new Error(
            `Video not found: ${video}`
        );
    }

    const interval =
        Number(
            options.interval ??
                DEFAULT_INTERVAL
        );

    const threshold =
        Number(
            options.threshold ??
                DEFAULT_THRESHOLD
        );

    if (
        !Number.isFinite(
            interval
        ) ||
        interval <= 0
    ) {
        throw new Error(
            "--interval must be greater than 0."
        );
    }

    if (
        !Number.isFinite(
            threshold
        ) ||
        threshold < 0 ||
        threshold > 100
    ) {
        throw new Error(
            "--threshold must be between 0 and 100."
        );
    }

    console.log("");
    console.log(
        "=========================================="
    );
    console.log(
        `${APP_NAME} AI Video Scanner v${VERSION}`
    );
    console.log(
        "=========================================="
    );

    console.log(
        `Model:       ${DEFAULT_MODEL}`
    );

    console.log(
        `Video:       ${path.resolve(video)}`
    );

    console.log(
        `Interval:    ${interval}s`
    );

    console.log(
        `Threshold:   ${threshold}%`
    );

    console.log("");

    const info =
        await getVideoInfo(
            video
        );

    console.log(
        `Duration:    ${formatTime(
            info.duration
        )}`
    );

    if (info.fps) {
        console.log(
            `FPS:         ${info.fps}`
        );
    }

    console.log("");

    const client =
        createOpenAIClient();

    const knownCharacters =
        loadKnownCharacters();

    if (
        knownCharacters.length
    ) {
        console.log(
            "Known characters:"
        );

        console.log(
            "  " +
            knownCharacters.join(
                ", "
            )
        );

        console.log("");
    }

    const tempDirectory =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "copyrightjs-"
            )
        );

    const detections = [];

    const frameResults = [];

    const totalFrames =
        Math.max(
            1,
            Math.ceil(
                info.duration /
                    interval
            )
        );

    let frameNumber = 0;

    try {
        for (
            let timestamp = 0;
            timestamp < info.duration;
            timestamp += interval
        ) {
            frameNumber++;

            const framePath =
                path.join(
                    tempDirectory,
                    `frame-${String(
                        frameNumber
                    ).padStart(
                        6,
                        "0"
                    )}.jpg`
                );

            const progress =
                Math.round(
                    Math.min(
                        100,
                        (
                            timestamp /
                            Math.max(
                                info.duration,
                                1
                            )
                        ) *
                            100
                    )
                );

            process.stdout.write(
                `\rAnalyzing frame ${frameNumber}/${totalFrames} — ${progress}%`
            );

            try {
                await extractFrame(
                    video,
                    timestamp,
                    framePath
                );

                const result =
                    await analyzeFrame(
                        client,
                        framePath,
                        knownCharacters
                    );

                frameResults.push({
                    timestamp,

                    timestampFormatted:
                        formatTime(
                            timestamp
                        ),

                    characters:
                        result.characters,

                    sceneDescription:
                        result.sceneDescription
                });

                for (
                    const character
                    of result.characters
                ) {
                    if (
                        character.confidence >=
                        threshold
                    ) {
                        addDetection(
                            detections,
                            timestamp,
                            character
                        );
                    }
                }
            } catch (error) {
                console.log("");

                console.error(
                    `Frame ${frameNumber} failed:`
                );

                console.error(
                    error.message
                );

                console.log(
                    "Continuing..."
                );
            }

            try {
                fs.unlinkSync(
                    framePath
                );
            } catch {}

            /*
             * Small delay so a very aggressive scan does not
             * immediately hammer the API.
             */

            if (
                frameNumber <
                totalFrames
            ) {
                await sleep(100);
            }
        }

        process.stdout.write(
            "\n"
        );
    } finally {
        try {
            fs.rmSync(
                tempDirectory,
                {
                    recursive: true,
                    force: true
                }
            );
        } catch {}
    }

    const report = {
        tool:
            APP_NAME,

        version:
            VERSION,

        aiUsed:
            true,

        provider:
            "OpenAI",

        model:
            DEFAULT_MODEL,

        video:
            path.resolve(video),

        scannedAt:
            new Date().toISOString(),

        settings: {
            interval,
            threshold
        },

        videoInfo:
            info,

        detections:
            finalizeDetections(
                detections
            ),

        frames:
            frameResults
    };

    printReport(
        report
    );

    if (
        options.json
    ) {
        const output =
            options.json === true
                ? "copyright-report.json"
                : options.json;

        fs.writeFileSync(
            path.resolve(output),
            JSON.stringify(
                report,
                null,
                2
            ),
            "utf8"
        );

        console.log(
            `JSON report saved to: ${path.resolve(
                output
            )}`
        );
    }

    return report;
}


// =========================================================
// Known character database
// =========================================================

function loadKnownCharacters() {
    const file =
        path.join(
            DATABASE_DIR,
            "characters.json"
        );

    if (
        !fs.existsSync(file)
    ) {
        return [];
    }

    try {
        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );

        if (
            !Array.isArray(data)
        ) {
            return [];
        }

        return data
            .map(
                value =>
                    typeof value ===
                    "string"
                        ? value
                        : value?.name
            )
            .filter(Boolean);
    } catch {
        return [];
    }
}

function addKnownCharacter(
    name
) {
    ensureDatabase();

    const file =
        path.join(
            DATABASE_DIR,
            "characters.json"
        );

    let characters =
        loadKnownCharacters();

    if (
        characters.some(
            character =>
                character.toLowerCase() ===
                name.toLowerCase()
        )
    ) {
        console.log(
            `"${name}" is already registered.`
        );

        return;
    }

    characters.push(
        name
    );

    fs.writeFileSync(
        file,
        JSON.stringify(
            characters,
            null,
            2
        ),
        "utf8"
    );

    console.log(
        `Added known character: ${name}`
    );
}


// =========================================================
// Report
// =========================================================

function printReport(
    report
) {
    console.log("");
    console.log(
        "=========================================="
    );
    console.log(
        "AI SCAN COMPLETE"
    );
    console.log(
        "=========================================="
    );

    if (
        report.detections.length === 0
    ) {
        console.log(
            "No characters passed the confidence threshold."
        );

        console.log("");

        console.log(
            "This does NOT prove that the video"
        );

        console.log(
            "contains no copyrighted material."
        );

        console.log("");

        return;
    }

    console.log(
        `Possible character appearances: ${report.detections.length}`
    );

    console.log("");

    for (
        const detection
        of report.detections
    ) {
        console.log(
            `[${detection.startTimeFormatted} - ${detection.endTimeFormatted}]`
        );

        console.log(
            `  Character:   ${detection.character}`
        );

        console.log(
            `  Franchise:   ${detection.franchise}`
        );

        console.log(
            `  Confidence:  ${detection.confidence}%`
        );

        console.log(
            `  Samples:     ${detection.samples}`
        );

        if (
            detection.evidence
        ) {
            console.log(
                `  Evidence:    ${detection.evidence}`
            );
        }

        console.log("");
    }

    console.log(
        "IMPORTANT:"
    );

    console.log(
        "These are AI visual-identification results,"
    );

    console.log(
        "not legal copyright or infringement decisions."
    );

    console.log("");
}


// =========================================================
// Models
// =========================================================

function showModels() {
    console.log("");
    console.log(
        "Copyright.js AI model configuration"
    );

    console.log(
        "===================================="
    );

    console.log(
        `Current model: ${DEFAULT_MODEL}`
    );

    console.log("");

    console.log(
        "Set another model with:"
    );

    console.log(
        "  COPYRIGHT_MODEL=<model> node Copyright.js scan video.mp4"
    );

    console.log("");

    console.log(
        "Example:"
    );

    console.log(
        "  COPYRIGHT_MODEL=gpt-5.5 node Copyright.js scan video.mp4"
    );

    console.log("");
}


// =========================================================
// Init
// =========================================================

function init() {
    ensureDatabase();

    const config = {
        version:
            VERSION,

        model:
            DEFAULT_MODEL,

        interval:
            DEFAULT_INTERVAL,

        threshold:
            DEFAULT_THRESHOLD,

        ai:
            true,

        provider:
            "OpenAI"
    };

    fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(
            config,
            null,
            2
        ),
        "utf8"
    );

    const charactersFile =
        path.join(
            DATABASE_DIR,
            "characters.json"
        );

    if (
        !fs.existsSync(
            charactersFile
        )
    ) {
        fs.writeFileSync(
            charactersFile,
            "[]",
            "utf8"
        );
    }

    console.log("");
    console.log(
        "Copyright.js initialized."
    );

    console.log(
        `Database: ${DATABASE_DIR}`
    );

    console.log(
        `Model:    ${DEFAULT_MODEL}`
    );

    console.log("");
}


// =========================================================
// Help
// =========================================================

function showHelp() {
    console.log(`
${APP_NAME} v${VERSION}
AI Video Character Detector
===========================

USAGE

  node Copyright.js <command> [arguments] [options]


COMMANDS

  init

      Initialize Copyright.js.

  scan <video>

      Analyze a video with AI.

  character <name>

      Add a known character to the local database.

  models

      Show AI model configuration.

  help

      Show this help.


SCAN OPTIONS

  --interval <seconds>

      Seconds between sampled frames.

      Default:
        ${DEFAULT_INTERVAL}

      Example:
        --interval 1

  --threshold <0-100>

      Minimum AI confidence required.

      Default:
        ${DEFAULT_THRESHOLD}

      Example:
        --threshold 80

  --json <file>

      Save a JSON report.

      Example:
        --json report.json


ENVIRONMENT VARIABLES

  OPENAI_API_KEY

      Required OpenAI API key.

  COPYRIGHT_MODEL

      AI model to use.

      Default:
        ${DEFAULT_MODEL}

  COPYRIGHT_INTERVAL

      Default scan interval.

  COPYRIGHT_THRESHOLD

      Default confidence threshold.


EXAMPLES

  node Copyright.js init

  node Copyright.js character Mario

  node Copyright.js character Sonic

  node Copyright.js scan video.mp4

  node Copyright.js scan video.mp4 --interval 1

  node Copyright.js scan video.mp4 --threshold 80

  node Copyright.js scan video.mp4 --interval 0.5 --threshold 75

  node Copyright.js scan video.mp4 --json report.json


ARCHITECTURE

  Video
     |
     v
  FFmpeg
     |
     v
  Sampled frames
     |
     v
  OpenAI vision model
     |
     v
  Character identification
     |
     v
  Confidence filtering
     |
     v
  JSON report


IMPORTANT

  Copyright.js cannot legally determine copyright
  ownership or infringement.

  AI predictions can be incorrect.

  A detected character does not automatically mean
  that the video infringes copyright.

  An undetected character does not prove that the
  video is copyright-free.
`);
}


// =========================================================
// Main
// =========================================================

async function main() {
    const args =
        parseArguments(
            process.argv.slice(2)
        );

    switch (
        args.command
    ) {
        case "init":
            init();
            break;

        case "models":
            showModels();
            break;

        case "character": {
            const name =
                args.positional[0];

            if (!name) {
                console.error(
                    "Usage: node Copyright.js character <name>"
                );

                process.exit(1);
            }

            addKnownCharacter(
                name
            );

            break;
        }

        case "scan": {
            const video =
                args.positional[0];

            if (!video) {
                console.error(
                    "Usage: node Copyright.js scan <video>"
                );

                process.exit(1);
            }

            await scanVideo(
                path.resolve(video),
                args.options
            );

            break;
        }

        case "help":
        case "-h":
        case "--help":
        case null:
            showHelp();
            break;

        default:
            console.error(
                `Unknown command: ${args.command}`
            );

            console.error(
                "Run: node Copyright.js help"
            );

            process.exit(1);
    }
}


// =========================================================
// Global error handling
// =========================================================

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "\nUnhandled error:"
        );

        console.error(
            error?.stack ||
            error?.message ||
            error
        );

        process.exit(1);
    }
);

main().catch(
    error => {
        console.error(
            "\nERROR:"
        );

        console.error(
            error?.stack ||
            error?.message ||
            error
        );

        process.exit(1);
    }
);
