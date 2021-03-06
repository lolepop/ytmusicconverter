import * as mm from "music-metadata";
import path from "path";

export type FormattedAudio = {
    path: string;
    name: string;
}

export class AudioFormatter
{
    format: string;
    outputFolder: string;
    container: string;
    
    private readonly illegalEscape = /[/?*"<>|:\\\t]/g;
    private readonly esc = /(?:(?<!(?<!\\)\\)%)/;
    private readonly inner = /(\w+)/;
    private readonly formatRegex: RegExp;

    public constructor(outputFolder: string, format: string, container: string = "flv")
    {
        this.outputFolder = outputFolder;
        this.format = format;
        this.container = container;

        this.formatRegex = new RegExp(`${this.esc.source}${this.inner.source}${this.esc.source}`, "g");
    }

    public static async getTags(file: string)
    {
        const meta = await mm.parseFile(file);
        return Object.entries(meta.native).reduce<{ [key: string]: any }>((acc, [_, v]) => {
            for (const tag of v)
                acc[tag.id] = acc[tag.id] ?? tag.value;
            return acc;
        }, {});

        // return new Promise((resolve: (r: TagType) => void, reject: (e: jsmediatagsError) => void) => jsmediatags.read(file, {
        //     onSuccess: resolve,
        //     onError: reject
        // }));
    }

    // returns both intended filename and valid filepath (without illegal characters)
    public async formatOutput(audioPath: string): Promise<FormattedAudio>
    {
        const audioMeta = await AudioFormatter.getTags(audioPath);
        // const audioMeta = { tags: [ "asdf" ] };
        const params = Object.entries(audioMeta).reduce<{ [key: string]: string }>((acc, [tag, v]) => (acc[`%${tag.toLowerCase()}%`] = v?.toString() ?? "", acc), {});

        const formattedName = this.format.replace(this.formatRegex, s => params[s.toLowerCase()]);
        return {
            path: `${path.join(this.outputFolder, formattedName.replace(this.illegalEscape, ""))}.${this.container}`,
            name: formattedName
        };
    }

}