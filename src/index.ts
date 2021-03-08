import {Command, flags} from "@oclif/command"
import { convertToVideo, convertToVideoBulk, matchFiles } from "./lib/converter"
import Listr = require("listr");
import path from "path";
const config = require("../config.json");

class Ytmusicconverter extends Command {
	static description = "merges music and static image into a video"

	static flags = {
		version: flags.version({ char: "v" }),
		help: flags.help({ char: "h" }),

		ffmpegWorkers: flags.integer({ char: "w", description: "max concucurrent ffmpeg workers", default: config.maxConcurrentConvert }),
		audioPattern: flags.string({ char: "a", description: "glob pattern to resolve audio tracks", default: config.audioGlob }),
		imagePattern: flags.string({ char: "i", description: "glob pattern to resolve image used", default: config.imageGlob }),
		convertPattern: flags.string({ char: "c", description: "naming pattern for output files", default: config.namingPattern })

	}

	static args = [
		{
			name: "input",
			required: true,
			parse: (a: string) => path.resolve(a)
		},
		{
			name: "output",
			required: true,
			parse: (a: string) => path.resolve(a)
		}
	]

	async run() {
		// await convertToVideo();
		const {args, flags} = this.parse(Ytmusicconverter);

		console.log(args);
		

		// const name = flags.name ?? "world"
		// this.log(`hello ${name} from .\\src\\index.ts`)
		// if (args.file && flags.force) {
		// 	this.log(`you input --force and --file: ${args.file}`)
		// }
		
		const audio = await matchFiles(flags.audioPattern, args.input);
		const covers = await matchFiles(flags.imagePattern, args.input);
		
		const conversions = await convertToVideoBulk(covers, audio, args.output, flags.convertPattern, flags.ffmpegWorkers);
		
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

export = Ytmusicconverter
