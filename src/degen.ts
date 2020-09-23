import * as Path from "https://deno.land/std@0.69.0/path/mod.ts";
import { createRequire } from "https://deno.land/std@0.69.0/node/module.ts";
import { ensureDirSync, copySync } from "https://deno.land/std@0.69.0/fs/mod.ts"

import { Util } from "./util.ts";
import { Pages } from "./pages.ts"
import { Temple } from "./temple.ts";
import { DegenError } from "./lib.ts";

async function main() {
    try {
        if (Deno.args.length === 1) {
            let path;
            try {
                path = Deno.realPathSync(Deno.args[0]);
            } catch (e: unknown) {
                throw new DegenError(
                    "D100",
                    "Project Config could not be found",
                    Path.resolve(Deno.cwd(), Deno.args[0])
                );
            }

            await generate(path);
        } else {
            console.log("Please provide path to project config file.");
        }
    } catch (e) {
        console.log(e);
    }
}

async function generate(project_config_path: string) {
    // I dont like that I need a pseudo require() to mimick node.js importing D: 
    // But im glad node modules are supported
    const require = createRequire(import.meta.url);
    const markit_mod = require('../dependencies/markdown-it.js');

    // Initialization - read in config file and instantiate required functionality 
    const config = await Util.openProjectConfig(project_config_path);
    const markit = markit_mod({
        html: config.degen.enable_html_in_markdown,    // Enable HTML tags in source
    });

    // Find all the pages in the directories declared in statis.toml - settings.pages
    const source_directory = Deno.realPathSync(config.project.source_path);
    const page_entries = Util.getSetOfAllPageEntries([source_directory]);
    const page_render_queue = new Array<Pages.Page>();
    const compendium = new Pages.Compendium();

    // Read in all the pages
    console.log("Preparing Pages...")
    try {
        for await (const page of page_entries) {
            const page_text = await Util.readFile(page)
            const statis_page = Pages.parsePage(page_text, page, config);

            // If public add to the array of public pages
            if (statis_page.get('is_public')) {
                page_render_queue.push(statis_page);
                compendium.addPage(statis_page);
            }
        }
    } catch (e) {
        console.log(e);
    }

    // console.log(compendium.toString());

    // Copy Passthrough
    for (const src_dir in config.project.passthrough) {
        const dest_dir = config.project.passthrough[src_dir];
        console.log(`Copying '${src_dir}' to '${dest_dir}'`);
        ensureDirSync(dest_dir);
        copySync(src_dir, dest_dir, {overwrite: true});
    }

    // Render all public pages :D
    console.log("Rendering...")
    try {
        for (const page of page_render_queue) {
            const plated_markdown = Temple.renderString(page.markdown(), page, compendium);
            page.setBody(markit.render(plated_markdown));
            const html = await Temple.render(page, compendium);
            await Util.writePage(html, page, config.degen);
        }
    } catch (e) {
        console.log(e);
    }

    console.log(`Site Rendered to ${Deno.realPathSync(config.project.export_path)}`);
}

main();