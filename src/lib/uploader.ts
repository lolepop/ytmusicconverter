import low, { LowdbAsync } from "lowdb";
import FileAsync from "lowdb/adapters/FileAsync";
import { ConvertedSchema } from "./converter";
import path from "path";
import { FormattedAudio } from "./audio-formatter";
import { init as initYoutube, YoutubeCookies, upload as uploadYoutube } from "youtube-studio";
import { ArgPromise, bindArgs } from "./util";
import fs from "fs";
import { promise as fastq } from "fastq";

export abstract class VideoUploader
{
    db?: low.LowdbAsync<ConvertedSchema>;
    videos: FormattedAudio[]

    constructor()
    {
        this.videos = [];
    }

    async getPendingVideos(path: string)
    {
        this.db = await low(new FileAsync<ConvertedSchema>(path));
        return this.db.get("videos").value();
    }

    async completeVideo(videoName: string)
    {
        await this.db
            ?.get("videos")
            .remove({ name: videoName })
            .write();
    }

    async setup(dbPath: string)
    {
        this.videos = await this.getPendingVideos(dbPath);
    }

    abstract upload(file: FormattedAudio, description: string, privacy: string): Promise<any>;
    abstract uploadAll(description: string, privacy: string, uploadWorkers: number): ArgPromise<any, any>[];

}

export class YoutubeUploader extends VideoUploader
{

    private credentials: YoutubeCookies;
    private channelId: string;

    constructor(channelId: string, credentials: YoutubeCookies)
    {
        super();
        this.credentials = credentials;
        this.channelId = channelId;
    }

    async setup(dbPath: string)
    {
        await super.setup(dbPath);
        await initYoutube(this.credentials);
    }

    uploadAll(description: string, privacy: string, uploadWorkers: number)
    {
        const convert = fastq(null, async ([f, completeCb]: [() => Promise<any>, () => Promise<any>]) => {
            const r = await f();
            await completeCb();
            return r;
        }, uploadWorkers);
        
        // stopped working after adding the queue. only works with a copy now for some reason
        return [...this.videos].map(f => {
            const dbUpdateFunc = bindArgs(this.completeVideo.bind(this))(f.name);
            const uploadFunc = bindArgs(this.upload.bind(this))(f, description, privacy);

            return {
                args: f,
                result: convert.push([dbUpdateFunc, uploadFunc])
            };

        });
    }

    async upload(file: FormattedAudio, description: string, privacy: string)
    {
        const uploadResult = await uploadYoutube({
            stream: fs.createReadStream(file.path),
            channelId: this.channelId,

            newTitle: file.name,
            newDescription: description,
            newPrivacy: privacy,

            isDraft: false,
        });

        return uploadResult;
    }
}
