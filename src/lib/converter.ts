import Ffmpeg from "fluent-ffmpeg";
import util from "util";
import path from "path";
import fs from "fs";
import glob from "glob";
import { AudioFormatter, FormattedAudio } from "./audio-formatter";
import { promise as fastq } from "fastq";
import low, { LowdbAsync } from "lowdb";
import FileAsync from "lowdb/adapters/FileAsync";

const defaultFfmpegCfg = { videoHeight: 2160, framerate: "1/10" };

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

export interface ConvertedSchema
{
    videos: FormattedAudio[]
}

type UnwrapPromise<T> = T extends PromiseLike<infer U> ? U : T;
type FormattedPath = UnwrapPromise<ReturnType<typeof matchFiles>>;
type SingleConvertArgs = [LowdbAsync<ConvertedSchema>, typeof convertToVideo, Parameters<typeof convertToVideo>];

export async function convertToVideoBulk(coverPath: FormattedPath, audioPath: FormattedPath, outputFolder: string, outputFormat: string, maxConcurrent: number, cfg: typeof defaultFfmpegCfg = defaultFfmpegCfg)
{
    const convert = fastq(null, async ([db, f, a]: SingleConvertArgs) => {
        const r = await f(...a);
        
        await db
            .get("videos")
            .push(a[2] as FormattedAudio)
            .write();

        return r;

    }, maxConcurrent);
    
    const audioFormatter = new AudioFormatter(outputFolder, outputFormat);

    // flatmap doesnt work on Promise<>[] lol
    const promises = await Promise.all(Object.entries(coverPath).map(async ([base, image]) => {
        // account for filenames that cannot exist on filesystem
        const db = await low(new FileAsync<ConvertedSchema>(path.join(outputFolder, "results.json")));
        await db.defaults({ videos: [] })
            .get("videos")
            .remove(() => true)
            .write();

        const audioFiles = audioPath[base] ?? [];
        const imagePath = path.join(base, image[0]);

        // audio files in same path as cover
        return Promise.all(audioFiles.map(async audio => {
            const audioPath = path.join(base, audio);
            const outputFile = await audioFormatter.formatOutput(audioPath);

            return {
                args: { imagePath, audioPath, outputFile },
                result: convert.push([db, convertToVideo, [imagePath, audioPath, outputFile, cfg]])
            };
        }));
    }));

    return promises.flat();
    
}

export async function convertToVideo(coverPath: string, audioPath: string, output: FormattedAudio | AudioFormatter, { videoHeight, framerate } = defaultFfmpegCfg)
{
    const outputFile = (output instanceof AudioFormatter ? await output.formatOutput(audioPath) : output).path;
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
