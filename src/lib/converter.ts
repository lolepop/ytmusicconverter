import Ffmpeg from "fluent-ffmpeg";
import util from "util";
import path from "path";
import fs from "fs";
import glob from "glob";
import AudioFormatter from "./audio-formatter";
import { promise as fastq } from "fastq"

const defaultFfmpegCfg = { videoHeight: 1080, framerate: 1 };

export async function matchFiles(globPattern: string, audioPath?: string)
{
    const _glob = util.promisify(glob);
    
    const cwd = audioPath ?? path.resolve(".");
    const matching = await _glob(globPattern, { cwd, nocase: true });

    const matchingMapped = matching.reduce<{ [key: string]: string[] }>((acc, p) => {
        const basePath = path.dirname(path.resolve(cwd, p));
        acc[basePath] = acc[basePath] ?? [];
        acc[basePath].push(path.basename(p));
        return acc;
    }, {});
    // console.log(matchingMapped);
    
    return matchingMapped;
}

export function resolveAudioCodec(format: string)
{
    const f = format.toLowerCase();
    switch (f)
    {
        case "flac":
            return "pcm_s16le";
        case "mp3":
        default:
            return "copy";
    }
}

type UnwrapPromise<T> = T extends PromiseLike<infer U> ? U : T;
type FormattedPath = UnwrapPromise<ReturnType<typeof matchFiles>>;
type convertArgs = [typeof convertToVideo, Parameters<typeof convertToVideo>];


export async function convertToVideoBulk(coverPath: FormattedPath, audioPath: FormattedPath, outputFolder: string, outputFormat: string, maxConcurrent: number, cfg: typeof defaultFfmpegCfg = defaultFfmpegCfg)
{
    const convert = fastq(null, ([f, a]: convertArgs) => f(...a), maxConcurrent);
    
    const audioFormatter = new AudioFormatter(outputFolder, outputFormat);

    const promises = await Promise.all(Object.entries(coverPath).flatMap(([base, image]) => {
        const audioFiles = audioPath[base] ?? [];
        const imagePath = path.join(base, image[0]);

        return audioFiles.map(async audio => {
            const audioPath = path.join(base, audio);
            const outputFile = await audioFormatter.formatOutput(audioPath);

            return {
                args: { imagePath, audioPath, outputFile },
                result: convert.push([convertToVideo, [imagePath, audioPath, outputFile.path, cfg]])
            };
        });
    }));

    return promises;
    
}

export async function convertToVideo(coverPath: string, audioPath: string, output: string | AudioFormatter, { videoHeight, framerate } = defaultFfmpegCfg)
{
    const outputFile = output instanceof AudioFormatter ? (await output.formatOutput(audioPath)).path : output;
    const audioCodec = resolveAudioCodec(path.extname(audioPath).substr(1));

    return new Promise((resolve, reject) => {
        Ffmpeg(coverPath)
            .inputOptions([`-r ${framerate}`, "-loop 1"])
            .input(audioPath)
            .audioCodec(audioCodec)
            .videoFilter(`scale=-1:${videoHeight}`)
            .outputOption("-shortest")
            // .on("start", (cmdline) => console.log(cmdline))
            // .on("progress", function(info) {
            //     console.log("progress " + JSON.stringify(info) + "%");
            // })
            .on("end", () => resolve(`Successfully processed ${audioPath} -> ${outputFile}`))
            .on("error", err => reject(err))
            .save(outputFile);
    });
    
}
