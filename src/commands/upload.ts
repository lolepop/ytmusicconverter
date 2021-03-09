import {Command, flags} from "@oclif/command";
import Listr from "listr";
import path from "path";
import { YoutubeUploader } from "../lib/uploader";
const config = require("../../config.json");

export default class Uploader extends Command
{
    static description = "uploads converted files based on json";

	static flags = {
		version: flags.version({ char: "v" }),
		help: flags.help({ char: "h" }),

        description: flags.string({ char: "d", description: "description of uploaded video", default: "" }),
		uploadWorkers: flags.integer({ char: "w", description: "number of concurrent uploads at once", default: 2 })
	};

	static args = [
		{
			name: "input",
            description: "db file generated in conversion output folder",
			required: true,
			parse: (a: string) => path.resolve(a)
		}
	];

	async run()
    {
		const {args, flags} = this.parse(Uploader);

		const uploader = new YoutubeUploader(config.channelId, {
			APISID: config.APISID,
			HSID: config.HSID,
			SAPISID: config.SAPISID,
			SID: config.SID,
			LOGIN_INFO: config.LOGIN_INFO,
			SSID: config.SSID,
		});

		await uploader.setup(args.input);
		
		const uploads = uploader.uploadAll(flags.description, "PRIVATE", flags.uploadWorkers);

		const tasks = new Listr([
			{
				title: "Uploading files",
				task: () => new Listr(uploads.map(p => ({
					title: p.args.name,
					task: () => p.result
				})), { concurrent: true, exitOnError: false })
			}
		]);

		tasks.run();

	}
}
