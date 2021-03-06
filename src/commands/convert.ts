import {Command, flags} from "@oclif/command";
import { convertToVideo, convertToVideoBulk, matchFiles } from "../lib/converter";
import Listr = require("listr");
import path from "path";
import { AudioFormatter } from "../lib/audio-formatter";
const config = require("../../config.json");

export default class Converter extends Command
{
	static description = "merges music and a static image into a video";

	static flags = {
		version: flags.version({ char: "v" }),
		help: flags.help({ char: "h" }),

		ffmpegWorkers: flags.integer({ char: "w", description: "max concucurrent ffmpeg workers", default: config.maxConcurrentConvert }),
		audioPattern: flags.string({ char: "a", description: "glob pattern to resolve audio tracks", default: config.audioGlob }),
		imagePattern: flags.string({ char: "i", description: "glob pattern to resolve image used", default: config.imageGlob }),
		convertPattern: flags.string({ char: "c", description: "naming pattern for output files", default: config.namingPattern }),
		tag: flags.string({ char: "t", description: "display tags for a file and its labels" }),

		resolution: flags.integer({ char: "r", description: "output resolution of video (fix height, scale width)", default: 1080 })
	};

	static args = [
		{
			name: "input",
			required: false,
			parse: (a: string) => path.resolve(a),
			default: path.resolve(".")
		},
		{
			name: "output",
			required: false,
			parse: (a: string) => path.resolve(a),
			default: path.resolve("./out")
		}
	];

	async run()
	{
		const {args, flags} = this.parse(Converter);

		if (flags.tag !== undefined)
		{
			const p = path.resolve(args.input, flags.tag);
			console.dir(await AudioFormatter.getTags(p), { depth: 0 });
			console.dir(await new AudioFormatter(args.input, flags.convertPattern).formatOutput(p));
			return;
		}

		const audio = await matchFiles(flags.audioPattern, args.input);
		const covers = await matchFiles(flags.imagePattern, args.input);

		const conversions = await convertToVideoBulk(covers, audio, args.output, flags.convertPattern, flags.ffmpegWorkers, flags.resolution);
		
		const tasks = new Listr([
			{
				title: "Processing files into videos",
				task: () => new Listr(conversions.map(p => ({
					title: p.args.outputFile.name,
					task: () => p.result
				})), { concurrent: true, exitOnError: true })
			}
		]);

		tasks.run();
	}
}
