import {Command, flags} from "@oclif/command";
import path from "path";

export default class Uploader extends Command
{
    static description = "uploads converted files based on json";

	static flags = {
		version: flags.version({ char: "v" }),
		help: flags.help({ char: "h" }),

        description: flags.string({ char: "d" })

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

		// load db records and upload
		
	}
}
