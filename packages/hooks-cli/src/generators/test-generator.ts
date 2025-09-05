/**
 * Test generator
 */

import { getTemplate } from "../templates/index.js";
import { getFilePath, getHooksTestDir } from "../utils/path-resolution.js";
import { BaseGenerator } from "./base-generator.js";

export class TestGenerator extends BaseGenerator {
	async generate(): Promise<void> {
		const templateFunction = getTemplate("test", this.getLanguage());
		const content = templateFunction(this.options.name);

		const testDir = getHooksTestDir(this.options.workspacePath);
		const filePath = getFilePath(
			testDir,
			this.options.name,
			this.getExtension(),
			"test",
		);

		await this.writeFile(filePath, content);
	}
}
