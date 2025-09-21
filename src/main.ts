// src/main.ts
import SrtParser from '@qgustavor/srt-parser';
import { promises as fs } from 'fs';
import type {
    RunRequest,
} from '@crowbartools/firebot-custom-scripts-types';

interface SubtitleParameters {
    subtitleFile: string;
    fontSize: number;
    textColor: string;
    outline: boolean;
    outlineWidth: number;
    outlineColor: string;
    containerWidth: number;
    [key: string]: any;
}

type DelayEffect = { type: 'firebot:delay'; delay: number };
type ShowTextEffect = {
    type: 'firebot:showtext';
    text: string;
    duration: number;
    position: string;
    width: number;
    dropShadow: boolean;
};
type CustomEffect = DelayEffect | ShowTextEffect;

export default {
    getScriptManifest: () => {
        return {
            name: "Subtitle Displayer",
            description: "Reads an SRT subtitle file and displays it on the overlay with correct timing and custom styles.",
            author: "Oshimia",
            version: "1.3",
            firebotVersion: "5",
        };
    },

    getDefaultParameters: () => {
        return {
            subtitleFile: {
                type: 'filepath',
                description: 'Select the .srt subtitle file to display.',
                fileOptions: {
                    filters: [{ name: 'SubRip Subtitle', extensions: ['srt'] }]
                }
            },
            containerWidth: {
                type: 'number',
                description: 'The width of the text container in pixels. Adjust if text is wrapping too soon.',
                default: 1200,
            },
            fontSize: {
                type: 'number',
                description: 'Font size for the subtitles in pixels.',
                default: 48,
            },
            textColor: {
                type: 'string',
                description: 'The color of the subtitle text (hex code, e.g., #FFFFFF).',
                default: '#FFFFFF',
            },
            outline: {
                type: 'boolean',
                description: 'Enable or disable a text outline for better visibility.',
                default: true,
            },
            outlineWidth: {
                type: 'number',
                description: 'The width of the text outline in pixels.',
                default: 2,
            },
            outlineColor: {
                type: 'string',
                description: 'The color of the text outline (hex code, e.g., #222222).',
                default: '#222222',
            },
        };
    },

    run: async (runRequest: RunRequest<SubtitleParameters>): Promise<{ success: boolean; effects?: CustomEffect[]; errorMessage?: string; }> => {
        const { parameters, modules } = runRequest;
        const { logger } = modules;
        const {
            subtitleFile,
            fontSize,
            textColor,
            outline,
            outlineWidth,
            outlineColor,
            containerWidth,
        } = parameters;

        const srtTimeToSeconds = (time: string): number => {
            const parts = time.replace(',', '.').split(':');
            const hours = parseFloat(parts[0]);
            const minutes = parseFloat(parts[1]);
            const seconds = parseFloat(parts[2]);
            return (hours * 3600) + (minutes * 60) + seconds;
        };

        if (!subtitleFile || typeof subtitleFile !== 'string') {
            logger.error('Subtitle file path is not configured.');
            return { success: false, errorMessage: 'Subtitle file path not set.' };
        }

        try {
            const srtContent = await fs.readFile(subtitleFile, 'utf-8');
            const parser = new SrtParser();
            const subtitles = parser.fromSrt(srtContent);

            const effects: CustomEffect[] = [];
            let lastTime = 0;

            for (const subtitle of subtitles) {
                const startTimeInSeconds = srtTimeToSeconds(String(subtitle.startTime));
                const endTimeInSeconds = srtTimeToSeconds(String(subtitle.endTime));
                const subtitleDuration = endTimeInSeconds - startTimeInSeconds;

                const delayUntilShow = startTimeInSeconds - lastTime;
                if (delayUntilShow > 0.05) {
                    effects.push({ type: 'firebot:delay', delay: delayUntilShow });
                }

                const styles: string[] = [];
                styles.push(`color: ${textColor || '#FFFFFF'};`);
                styles.push(`font-size: ${fontSize || 48}px;`);
                if (outline) {
                    styles.push(`-webkit-text-stroke: ${outlineWidth || 2}px ${outlineColor || '#222222'};`);
                }
                const styledText = `<span style="${styles.join(' ')}">${subtitle.text}</span>`;

                if (subtitleDuration > 0) {
                     effects.push({
                        type: 'firebot:showtext',
                        text: styledText,
                        duration: subtitleDuration,
                        position: 'Bottom Middle',
                        width: containerWidth || 1200,
                        dropShadow: false,
                    });
                }
                
                if (subtitleDuration > 0) {
                    effects.push({ type: 'firebot:delay', delay: subtitleDuration });
                }
                
                lastTime = endTimeInSeconds;
            }

            return {
                success: true,
                effects,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to read or parse subtitle file:', errorMessage);
            return { success: false, errorMessage: 'Failed to process subtitle file.' };
        }
    }
};