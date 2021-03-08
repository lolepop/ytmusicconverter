import {Command, flags} from "@oclif/command"
import { convertToVideo, convertToVideoBulk, matchFiles } from "./lib/converter"
import Listr = require("listr");
import path from "path";
const config = require("../config.json");

class Ytmusicconverter extends Command {
	static description = "merges music and static image into a video"

	static flags = {
		version: flags.version({char: "v"}),
		help: flags.help({char: "h"}),

		name: flags.string({char: "n", description: "name to print"}),
		force: flags.boolean({char: "f"}),
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
		
		const audio = await matchFiles(config.audioGlob, args.input);
		const covers = await matchFiles(config.imageGlob, args.input);
		
		const conversions = await convertToVideoBulk(covers, audio, args.output, config.namingPattern);
		
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
